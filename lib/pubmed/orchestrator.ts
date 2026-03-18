// The brain of the RAG pipeline.
// Single entry point: answer(query) → cited response with sources

import { db } from '@/src/db';
import {
	searchQueries,
	queryCitations,
	nihPapers,
} from '@/src/db/schemas/schema';
import { inArray } from 'drizzle-orm';
import { ingestPapers } from '@/lib/pubmed/ingest';
import { generateResponse, type GeneratedResponse } from '@/lib/llm';
import { searchChunks, checkCacheCoverage, type SearchResult } from './search';
import { searchAndFetchPapers, buildNutritionQuery } from '@/lib/pubmed/pubmed';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrchestratorResponse {
	query: string;
	answer: string;
	citations: {
		pmid: string;
		title: string;
		year: number | null;
		doi: string | null;
	}[];
	cacheHit: boolean;
	papersUsed: PaperReference[];
	meta: {
		chunksRetrieved: number;
		papersSearched: number;
		papersIngested: number;
		responseTimeMs: number;
	};
}

export interface ContextChunk {
	content: string;
	section: string | null;
	similarity: number;
	pmid: string;
	paperTitle: string;
	year: number | null;
}

export interface PaperReference {
	pmid: string;
	title: string;
	authors: string | null;
	year: number | null;
	doi: string | null;
	publicationType: string | null;
	relevanceScore: number;
}

interface OrchestratorOptions {
	userId?: string;
	cacheThreshold?: number;
	minCacheChunks?: number;
	searchThreshold?: number;
	topK?: number;
	maxPubMedResults?: number;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function answer(
	query: string,
	options: OrchestratorOptions = {},
): Promise<OrchestratorResponse> {
	const {
		userId,
		cacheThreshold = 0.55,
		minCacheChunks = 2,
		searchThreshold = 0.45,
		topK = 6,
		maxPubMedResults = 8,
	} = options;

	const startTime = Date.now();
	let cacheHit = false;
	let papersSearched = 0;
	let papersIngested = 0;
	let chunks: SearchResult[] = [];

	// ── Step 1: Check cache ──────────────────────────────────────────────────

	const cache = await checkCacheCoverage(query, {
		minChunks: minCacheChunks,
		threshold: cacheThreshold,
	});

	if (cache.sufficient) {
		cacheHit = true;
		chunks = await searchChunks(query, {
			topK,
			threshold: searchThreshold,
		});
	} else {
		// ── Step 2: Cache miss — fetch from PubMed ───────────────────────────

		// Clean the query: remove stop words and short noise words
		const stopWords = new Set([
			'is',
			'are',
			'was',
			'were',
			'do',
			'does',
			'did',
			'can',
			'could',
			'should',
			'would',
			'will',
			'shall',
			'may',
			'might',
			'must',
			'a',
			'an',
			'the',
			'and',
			'or',
			'but',
			'not',
			'no',
			'nor',
			'for',
			'to',
			'of',
			'in',
			'on',
			'at',
			'by',
			'with',
			'from',
			'it',
			'its',
			'this',
			'that',
			'these',
			'those',
			'i',
			'me',
			'my',
			'you',
			'your',
			'we',
			'our',
			'they',
			'them',
			'what',
			'which',
			'who',
			'whom',
			'how',
			'why',
			'when',
			'where',
			'bad',
			'good',
			'best',
			'worst',
			'help',
			'really',
			'very',
		]);

		const keywords = query
			.toLowerCase()
			.replace(/[?!.,;:'"]/g, '')
			.split(/\s+/)
			.filter((w) => w.length > 2 && !stopWords.has(w));

		const pubmedQuery =
			keywords.length > 0
				? buildNutritionQuery(keywords, { humansOnly: true })
				: query; // Fallback to raw query if everything got filtered

		const papers = await searchAndFetchPapers(pubmedQuery, {
			maxResults: maxPubMedResults,
			sort: 'relevance',
			filters: ['free full text'],
		});

		// ── Step 3: Ingest new papers ────────────────────────────────────────

		if (papers.length > 0) {
			const ingestResult = await ingestPapers(papers);
			papersIngested = ingestResult.papersStored;
		}

		// ── Step 4: Search again with fresh data ─────────────────────────────

		chunks = await searchChunks(query, {
			topK,
			threshold: searchThreshold,
		});
	}

	// ── Step 5: Build context and paper references ───────────────────────────

	const context = buildContext(chunks);
	const papersUsed = deduplicatePapers(chunks);

	// ── Step 6: Generate LLM response ────────────────────────────────────────

	const llmResponse = await generateResponse(query, context, papersUsed);
	const responseTimeMs = Date.now() - startTime;

	// ── Step 7: Log analytics ────────────────────────────────────────────────

	await logQuery({
		userId,
		query,
		cacheHit,
		chunksUsed: chunks.length,
		responseTimeMs,
		papersUsed,
	}).catch((err) => {
		console.error('Failed to log query analytics:', err);
	});

	return {
		query,
		answer: llmResponse.answer,
		citations: llmResponse.citations,
		cacheHit,
		papersUsed,
		meta: {
			chunksRetrieved: chunks.length,
			papersSearched,
			papersIngested,
			responseTimeMs,
		},
	};
}

// ─── Build context from chunks ───────────────────────────────────────────────

function buildContext(chunks: SearchResult[]): ContextChunk[] {
	return chunks.map((chunk) => ({
		content: chunk.content,
		section: chunk.section,
		similarity: chunk.similarity,
		pmid: chunk.paper.pmid,
		paperTitle: chunk.paper.title,
		year: chunk.paper.year,
	}));
}

// ─── Deduplicate papers from chunks ──────────────────────────────────────────

function deduplicatePapers(chunks: SearchResult[]): PaperReference[] {
	const paperMap = new Map<string, PaperReference>();

	for (const chunk of chunks) {
		const existing = paperMap.get(chunk.paper.pmid);

		if (!existing || chunk.similarity > existing.relevanceScore) {
			paperMap.set(chunk.paper.pmid, {
				pmid: chunk.paper.pmid,
				title: chunk.paper.title,
				authors: chunk.paper.authors,
				year: chunk.paper.year,
				doi: chunk.paper.doi,
				publicationType: chunk.paper.publicationType,
				relevanceScore: chunk.similarity,
			});
		}
	}

	return Array.from(paperMap.values()).sort(
		(a, b) => b.relevanceScore - a.relevanceScore,
	);
}

// ─── Log query analytics ─────────────────────────────────────────────────────

async function logQuery(data: {
	userId?: string;
	query: string;
	cacheHit: boolean;
	chunksUsed: number;
	responseTimeMs: number;
	papersUsed: PaperReference[];
}) {
	const [inserted] = await db
		.insert(searchQueries)
		.values({
			userId: data.userId ?? null,
			query: data.query,
			cacheHit: data.cacheHit,
			chunksUsed: data.chunksUsed,
			responseTime: data.responseTimeMs,
		})
		.returning({ id: searchQueries.id });

	if (data.papersUsed.length > 0 && inserted) {
		const papers = await db
			.select({ id: nihPapers.id, pmid: nihPapers.pmid })
			.from(nihPapers)
			.where(
				inArray(
					nihPapers.pmid,
					data.papersUsed.map((p) => p.pmid),
				),
			);

		const pmidToId = new Map(papers.map((p) => [p.pmid, p.id]));

		const validCitations = data.papersUsed
			.filter((p) => pmidToId.has(p.pmid))
			.map((p) => ({
				queryId: inserted.id,
				paperId: pmidToId.get(p.pmid)!,
				relevanceScore: p.relevanceScore,
			}));

		if (validCitations.length > 0) {
			await db.insert(queryCitations).values(validCitations);
		}
	}
}
