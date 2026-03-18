// This is the core "just-in-time" indexing pipeline.
// Pipeline: PubMed papers → chunk → embed → store in Supabase pgvector

import { db } from '@/src/db';
import { nihPapers, nihChunks } from '@/src/db/schemas/schema';
import { eq } from 'drizzle-orm';
import type { PubMedPaper } from './pubmed';
import { chunkPaper } from './chunker';
import { generateEmbeddingsBatched } from './embeddings';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngestResult {
	papersStored: number;
	papersSkipped: number; // Already existed in DB
	chunksCreated: number;
	chunksEmbedded: number;
}

// ─── Main ingest pipeline ────────────────────────────────────────────────────

export async function ingestPapers(
	papers: PubMedPaper[],
): Promise<IngestResult> {
	const result: IngestResult = {
		papersStored: 0,
		papersSkipped: 0,
		chunksCreated: 0,
		chunksEmbedded: 0,
	};

	for (const paper of papers) {
		// 1. Check if paper already exists (dedup by PMID)
		const existing = await db
			.select({ id: nihPapers.id })
			.from(nihPapers)
			.where(eq(nihPapers.pmid, paper.pmid))
			.limit(1);

		if (existing.length > 0) {
			result.papersSkipped++;
			continue;
		}

		// 2. Store paper metadata
		const [insertedPaper] = await db
			.insert(nihPapers)
			.values({
				pmid: paper.pmid,
				pmcId: paper.pmcId,
				title: paper.title,
				authors: paper.authors,
				journal: paper.journal,
				year: paper.year,
				doi: paper.doi,
				abstract: paper.abstract,
				publicationType: paper.publicationType,
			})
			.returning({ id: nihPapers.id });

		result.papersStored++;

		// 3. Chunk the paper
		// For now, we only have abstracts. When you add PMC full-text
		// fetching later, pass it as the second argument.
		const chunks = chunkPaper(paper.abstract, null);

		if (chunks.length === 0) continue;

		// 4. Generate embeddings for all chunks
		const texts = chunks.map((c) => c.content);
		let embeddings: number[][];

		try {
			embeddings = await generateEmbeddingsBatched(texts, {
				batchSize: 8, // Conservative for free tier
				delayMs: 300,
			});
			result.chunksEmbedded += embeddings.length;
		} catch (error) {
			console.error(
				`Failed to embed chunks for PMID ${paper.pmid}:`,
				error,
			);
			// Store chunks without embeddings — we can retry later
			embeddings = chunks.map(() => []);
		}

		// 5. Store chunks with embeddings in Supabase
		const chunkRows = chunks.map((chunk, i) => ({
			paperId: insertedPaper.id,
			chunkIndex: chunk.chunkIndex,
			content: chunk.content,
			section: chunk.section,
			tokenCount: chunk.tokenCount,
			embedding:
				embeddings[i] && embeddings[i].length > 0
					? embeddings[i]
					: null,
		}));

		await db.insert(nihChunks).values(chunkRows);
		result.chunksCreated += chunkRows.length;
	}

	return result;
}

// ─── Re-embed chunks that failed ─────────────────────────────────────────────
// Call this to retry embedding for any chunks stored without embeddings

import { isNull } from 'drizzle-orm';

export async function reembedFailedChunks(
	limit = 50,
): Promise<{ updated: number }> {
	// Find chunks without embeddings
	const unembedded = await db
		.select({
			id: nihChunks.id,
			content: nihChunks.content,
		})
		.from(nihChunks)
		.where(isNull(nihChunks.embedding))
		.limit(limit);

	if (unembedded.length === 0) return { updated: 0 };

	const texts = unembedded.map((c) => c.content);
	const embeddings = await generateEmbeddingsBatched(texts, {
		batchSize: 8,
		delayMs: 300,
	});

	let updated = 0;

	for (let i = 0; i < unembedded.length; i++) {
		if (embeddings[i] && embeddings[i].length > 0) {
			await db
				.update(nihChunks)
				.set({ embedding: embeddings[i] })
				.where(eq(nihChunks.id, unembedded[i].id));
			updated++;
		}
	}

	return { updated };
}
