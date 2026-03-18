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
import { searchAndFetchPapers, buildNutritionQuery } from '@/lib/pubmed/pubmed';
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
		// ── Step 2: Cache miss - fetch from PubMed ───────────────────────────

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

		const medicalTerms = new Set([
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

		const keywords = query
			.toLowerCase()
			.replace(/[?!.,;:'"]/g, '')
			.split(/\s+/)
			.filter((w) => w.length > 2 && !stopWords.has(w));

		const meaningful = keywords.filter(
			(w) => medicalTerms.has(w) || w.length > 5,
		);

		const searchTerms =
			meaningful.length > 0
				? meaningful.slice(0, 4)
				: keywords.slice(0, 3);

		const pubmedQuery =
			searchTerms.length > 0
				? `${searchTerms.join(' ')} AND humans[MeSH Terms]`
				: query;

		const papers = await searchAndFetchPapers(pubmedQuery, {
			maxResults: maxPubMedResults,
			sort: 'relevance',
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
