// Similarity search over NIH paper chunks using Supabase pgvector

import { db } from '@/src/db';
import { generateEmbedding } from '@/lib/pubmed/embeddings';
import { nihChunks, nihPapers } from '@/src/db/schemas/schema';
import { cosineDistance, desc, gt, sql, eq, and, isNotNull } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
	chunkId: string;
	content: string;
	section: string | null;
	similarity: number;
	paper: {
		id: string;
		pmid: string;
		pmcId: string | null;
		title: string;
		authors: string | null;
		year: number | null;
		doi: string | null;
		publicationType: string | null;
	};
}

export interface SearchOptions {
	topK?: number;
	threshold?: number;
	maxAgeDays?: number;
}

// ─── Main search function ────────────────────────────────────────────────────

export async function searchChunks(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResult[]> {
	const { topK = 8, threshold = 0.78, maxAgeDays = 30 } = options;

	// 1. Embed the user's query
	const queryEmbedding = await generateEmbedding(query);

	// 2. Compute similarity as 1 - cosine distance
	const similarity = sql<number>`1 - (${cosineDistance(nihChunks.embedding, queryEmbedding)})`;

	// 3. Build the age filter
	const ageFilter = maxAgeDays
		? gt(
				nihChunks.createdAt,
				sql`now() - interval '${sql.raw(String(maxAgeDays))} days'`,
			)
		: undefined;

	// 4. Query with join to papers
	const results = await db
		.select({
			chunkId: nihChunks.id,
			content: nihChunks.content,
			section: nihChunks.section,
			similarity,
			paperId: nihPapers.id,
			pmid: nihPapers.pmid,
			pmcId: nihPapers.pmcId,
			title: nihPapers.title,
			authors: nihPapers.authors,
			year: nihPapers.year,
			doi: nihPapers.doi,
			publicationType: nihPapers.publicationType,
		})
		.from(nihChunks)
		.innerJoin(nihPapers, eq(nihChunks.paperId, nihPapers.id))
		.where(
			and(
				gt(similarity, threshold),
				isNotNull(nihChunks.embedding),
				ageFilter,
			),
		)
		.orderBy(desc(similarity))
		.limit(topK);

	// 5. Shape the response
	return results.map((r) => ({
		chunkId: r.chunkId,
		content: r.content,
		section: r.section,
		similarity: r.similarity,
		paper: {
			id: r.paperId,
			pmid: r.pmid,
			pmcId: r.pmcId,
			title: r.title,
			authors: r.authors,
			year: r.year,
			doi: r.doi,
			publicationType: r.publicationType,
		},
	}));
}

// ─── Check cache coverage ────────────────────────────────────────────────────
// Used by the orchestrator to decide if we need to fetch from PubMed

export async function checkCacheCoverage(
	query: string,
	options: { minChunks?: number; threshold?: number } = {},
): Promise<{ sufficient: boolean; chunks: SearchResult[] }> {
	const { minChunks = 2, threshold = 0.7 } = options;

	const chunks = await searchChunks(query, {
		topK: minChunks,
		threshold,
	});

	return {
		sufficient: chunks.length >= minChunks,
		chunks,
	};
}
