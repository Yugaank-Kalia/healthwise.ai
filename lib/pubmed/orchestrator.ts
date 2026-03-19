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
import { generateResponse } from '@/lib/llm';
import { searchChunks, checkCacheCoverage, type SearchResult } from './search';
import { searchAndFetchPapers, PubMedPaper } from '@/lib/pubmed/pubmed';
import { isNutritionQuery } from './guard';

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

// ─── Constants ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
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
	'much',
	'many',
	'some',
	'any',
	'every',
	'each',
	'need',
	'per',
	'day',
	'make',
	'take',
	'get',
	'has',
	'have',
	'had',
	'been',
	'being',
	'about',
	'more',
	'most',
	'other',
	'into',
]);

const MEDICAL_TERMS = new Set([
	'protein',
	'vitamin',
	'mineral',
	'omega',
	'calcium',
	'iron',
	'zinc',
	'magnesium',
	'fiber',
	'carb',
	'carbohydrate',
	'fat',
	'cholesterol',
	'sodium',
	'potassium',
	'supplement',
	'deficiency',
	'intake',
	'diet',
	'nutrition',
	'muscle',
	'bone',
	'heart',
	'liver',
	'kidney',
	'blood',
	'sugar',
	'pressure',
	'weight',
	'sleep',
	'anxiety',
	'depression',
	'inflammation',
	'antioxidant',
	'creatine',
	'collagen',
	'probiotic',
	'prebiotic',
	'amino',
	'fatty',
	'acid',
	'seed',
	'oil',
	'fish',
	'folate',
	'biotin',
	'melatonin',
	'caffeine',
	'glucose',
	'insulin',
	'cortisol',
	'thyroid',
	'estrogen',
	'testosterone',
	'serotonin',
	'dopamine',
]);

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
	let papersSearched = 0;
	let papersIngested = 0;

	// ── Step 0: Topic check ──────────────────────────────────────────────

	const onTopic = await isNutritionQuery(query);

	if (!onTopic) {
		return {
			query,
			answer: 'I can only answer questions about nutrition, diet, supplements, and health. Try asking about a specific food, nutrient, or health condition.',
			citations: [],
			cacheHit: false,
			papersUsed: [],
			meta: {
				chunksRetrieved: 0,
				papersSearched: 0,
				papersIngested: 0,
				responseTimeMs: Date.now() - startTime,
			},
		};
	}

	// ── Step 1: Split multi-question queries ─────────────────────────────

	const subQueries = query
		.split(/\d+\.\s+|\n\n|;/)
		.map((q) => q.replace(/^\d+[\.\)]\s*/, '').trim())
		.filter((q) => q.length > 10);

	const queries = subQueries.length > 1 ? subQueries : [query];

	// ── Step 2: Check cache per sub-query ────────────────────────────────

	let cachedChunks: SearchResult[] = [];
	const uncachedQueries: string[] = [];

	for (const q of queries) {
		const cache = await checkCacheCoverage(q, {
			minChunks: minCacheChunks,
			threshold: cacheThreshold,
		});

		if (cache.sufficient) {
			const results = await searchChunks(q, {
				topK,
				threshold: searchThreshold,
			});
			cachedChunks.push(...results);
		} else {
			uncachedQueries.push(q);
		}
	}
	const cacheHit = uncachedQueries.length === 0;

	// ── Step 3: Fetch from PubMed for uncached queries only ──────────────

	if (uncachedQueries.length > 0) {
		let allPapers: PubMedPaper[] = [];

		for (const q of uncachedQueries) {
			const pubmedQuery = buildPubMedQuery(q);
			const papers = await searchAndFetchPapers(pubmedQuery, {
				maxResults: Math.ceil(
					maxPubMedResults / uncachedQueries.length,
				),
				sort: 'relevance',
			});

			allPapers.push(...papers);
		}

		papersSearched = allPapers.length;

		// ── Step 4: Ingest new papers ────────────────────────────────────

		if (allPapers.length > 0) {
			const ingestResult = await ingestPapers(allPapers);
			papersIngested = ingestResult.papersStored;
		}

		// ── Step 5: Search again for uncached queries with fresh data ────

		for (const q of uncachedQueries) {
			const results = await searchChunks(q, {
				topK,
				threshold: searchThreshold,
			});
			cachedChunks.push(...results);
		}
	}

	// ── Step 6: Deduplicate chunks ───────────────────────────────────────

	const seenChunkIds = new Set<string>();
	const chunks = cachedChunks
		.filter((c) => {
			if (seenChunkIds.has(c.chunkId)) return false;
			seenChunkIds.add(c.chunkId);
			return true;
		})
		.slice(0, topK);

	// ── Step 7: Build context and paper references ───────────────────────

	if (chunks.length === 0) {
		return {
			query,
			answer: "I wasn't able to find relevant research on that topic in the NIH database. This may be a very niche area or the query may need to be rephrased. Try asking with different keywords or a more specific medical term.",
			citations: [],
			cacheHit: false,
			papersUsed: [],
			meta: {
				chunksRetrieved: 0,
				papersSearched,
				papersIngested,
				responseTimeMs: Date.now() - startTime,
			},
		};
	}

	const context = buildContext(chunks);
	const papersUsed = deduplicatePapers(chunks);

	// ── Step 8: Generate LLM response ────────────────────────────────────

	const llmResponse = await generateResponse(query, context, papersUsed);
	const responseTimeMs = Date.now() - startTime;

	// ── Step 9: Log analytics ────────────────────────────────────────────

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

// ─── Build PubMed query from natural language ────────────────────────────────

function buildPubMedQuery(q: string): string {
	const keywords = q
		.toLowerCase()
		.replace(/[?!.,;:'"]/g, '')
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOP_WORDS.has(w));

	const meaningful = keywords.filter(
		(w) => MEDICAL_TERMS.has(w) || w.length > 5,
	);

	const searchTerms =
		meaningful.length > 0 ? meaningful.slice(0, 4) : keywords.slice(0, 3);

	return searchTerms.length > 0
		? `${searchTerms.join(' ')} AND humans[MeSH Terms]`
		: q;
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
