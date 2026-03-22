// Pipeline: PubMed papers → fetch full text (if PMC) → chunk → embed → store

import { db } from '@/src/db';
import { chunkPaper } from './chunker';
import { eq, isNull } from 'drizzle-orm';
import { fetchPMCFullText } from './pmc';
import type { PubMedPaper } from './pubmed';
import { nihPapers, nihChunks } from '@/src/db/schemas/nutrition-schema';
import { generateEmbeddingsBatched } from './embeddings';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngestResult {
	papersStored: number;
	papersSkipped: number;
	chunksCreated: number;
	chunksEmbedded: number;
	fullTextFetched: number;
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
		fullTextFetched: 0,
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

		// 2. Try to fetch full text from PMC (if available)
		let fullText: string | null = null;

		if (paper.pmcId) {
			try {
				const pmcResult = await fetchPMCFullText(paper.pmcId);
				if (pmcResult) {
					fullText = pmcResult.rawText;
					result.fullTextFetched++;
					console.log(
						`📄 Full text fetched for PMID ${paper.pmid} (${pmcResult.sections.length} sections, ${fullText.length} chars)`,
					);
				}
			} catch (error) {
				console.warn(
					`Failed to fetch PMC full text for ${paper.pmcId}:`,
					error,
				);
				// Continue with abstract only
			}
		}

		// 3. Store paper metadata
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

		// 4. Chunk the paper (abstract + full text if available)
		const chunks = chunkPaper(paper.abstract, fullText);

		if (chunks.length === 0) continue;

		// 5. Generate embeddings for all chunks
		const texts = chunks.map((c) => c.content);
		let embeddings: number[][];

		try {
			embeddings = await generateEmbeddingsBatched(texts, {
				batchSize: 8,
				delayMs: 300,
			});
			result.chunksEmbedded += embeddings.length;
		} catch (error) {
			console.error(
				`Failed to embed chunks for PMID ${paper.pmid}:`,
				error,
			);
			embeddings = chunks.map(() => []);
		}

		// 6. Store chunks with embeddings
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

export async function reembedFailedChunks(
	limit = 50,
): Promise<{ updated: number }> {
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
