// Cross-encoder reranker via HuggingFace Inference API
// Reranks search results by scoring query-document pairs together

import { InferenceClient } from '@huggingface/inference';
import type { SearchResult } from '@/lib/pubmed/search';

const HF_TOKEN = process.env.HUGGING_FACE_API_KEY;
const client = new InferenceClient(HF_TOKEN);
const MODEL_ID = 'BAAI/bge-reranker-base';

export interface RankedResult extends SearchResult {
	rerankerScore: number;
}

export async function rerankResults(
	query: string,
	results: SearchResult[],
	topK = 6,
	minSources = 4,
): Promise<RankedResult[]> {
	if (results.length === 0) return [];
	if (results.length <= topK) {
		return results.map((r) => ({ ...r, rerankerScore: r.similarity }));
	}

	const scored: RankedResult[] = [];
	const BATCH_SIZE = 10;

	for (let i = 0; i < results.length; i += BATCH_SIZE) {
		const batch = results.slice(i, i + BATCH_SIZE);

		const scores = await Promise.all(
			batch.map(async (result) => {
				try {
					const output = await client.textClassification({
						model: MODEL_ID,
						inputs: `${query} [SEP] ${result.content}`,
						provider: 'hf-inference',
					});
					return Array.isArray(output) ? (output[0]?.score ?? 0) : 0;
				} catch {
					return result.similarity; // fall back to vector score
				}
			}),
		);

		for (let j = 0; j < batch.length; j++) {
			scored.push({ ...batch[j], rerankerScore: scores[j] });
		}

		if (i + BATCH_SIZE < results.length) {
			await new Promise((r) => setTimeout(r, 200));
		}
	}

	scored.sort((a, b) => b.rerankerScore - a.rerankerScore);

	const selected: RankedResult[] = [];
	const seenPapers = new Set<string>();

	// Pass 1: take the top chunk from each unique paper until minSources diversity is met
	for (const result of scored) {
		if (seenPapers.size >= minSources) break;
		if (!seenPapers.has(result.paper.pmid)) {
			seenPapers.add(result.paper.pmid);
			selected.push(result);
		}
	}

	// Pass 2: fill remaining slots with highest scoring chunks regardless of paper
	for (const result of scored) {
		if (selected.length >= topK) break;
		if (!selected.includes(result)) {
			selected.push(result);
		}
	}

	return selected;
}
