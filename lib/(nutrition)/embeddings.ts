// Generate embeddings via @huggingface/inference SDK
// Model: NeuML/pubmedbert-base-embeddings (768 dimensions, medical domain)

import {
	InferenceClient,
	type FeatureExtractionOutput,
} from '@huggingface/inference';

const HF_TOKEN = process.env.HUGGING_FACE_API_KEY ?? '';

const client = new InferenceClient(HF_TOKEN);

const MODEL_ID = 'NeuML/pubmedbert-base-embeddings';

export const EMBEDDING_DIMENSIONS = 768;

// ─── Generate embeddings for multiple texts ──────────────────────────────────

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	const embeddings: number[][] = [];

	for (const text of texts) {
		const result = await client.featureExtraction({
			model: MODEL_ID,
			inputs: text,
			provider: 'hf-inference',
		});

		// featureExtraction returns number[] | number[][] | number[][][]
		// For sentence-transformers models it returns number[] (a single vector)
		// but can also return number[][] (token-level embeddings)
		const vector = normalizeEmbedding(result);
		embeddings.push(vector);
	}

	return embeddings;
}

// ─── Generate a single embedding ─────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
	const result = await client.featureExtraction({
		model: MODEL_ID,
		inputs: text,
		provider: 'hf-inference',
	});

	return normalizeEmbedding(result);
}

// ─── Batch with rate limiting ────────────────────────────────────────────────
// HF free tier has rate limits, so we batch in groups and add delays

export async function generateEmbeddingsBatched(
	texts: string[],
	options: { batchSize?: number; delayMs?: number } = {},
): Promise<number[][]> {
	const { batchSize = 8, delayMs = 300 } = options;
	const allEmbeddings: number[][] = [];

	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);

		const batchEmbeddings = await generateEmbeddings(batch);
		allEmbeddings.push(...batchEmbeddings);

		// Rate limit delay between batches (skip after last batch)
		if (i + batchSize < texts.length) {
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}

	return allEmbeddings;
}

// ─── Normalize the embedding output ──────────────────────────────────────────
// featureExtraction can return different shapes depending on the model.
// Sentence-transformers models return a flat vector (number[]),
// but some models return token-level embeddings (number[][]).
// We handle both cases.

function normalizeEmbedding(result: FeatureExtractionOutput): number[] {
	// Already a flat vector - most common for sentence-transformers
	if (Array.isArray(result) && typeof result[0] === 'number') {
		return result as number[];
	}

	// Token-level embeddings (number[][]) - mean pool them
	if (
		Array.isArray(result) &&
		Array.isArray(result[0]) &&
		typeof (result[0] as number[])[0] === 'number'
	) {
		const tokenEmbeddings = result as number[][];
		const dims = tokenEmbeddings[0].length;
		const pooled = new Array(dims).fill(0);

		for (const token of tokenEmbeddings) {
			for (let i = 0; i < dims; i++) {
				pooled[i] += token[i];
			}
		}

		for (let i = 0; i < dims; i++) {
			pooled[i] /= tokenEmbeddings.length;
		}

		return pooled;
	}

	// 3D tensor - flatten first dimension then mean pool
	if (Array.isArray(result) && Array.isArray(result[0])) {
		const flat = (result as number[][][])[0];
		return normalizeEmbedding(flat);
	}

	throw new Error(`Unexpected embedding shape: ${typeof result}`);
}
