// Split paper text into overlapping chunks for embedding

export interface Chunk {
	content: string;
	section: string;
	chunkIndex: number;
	tokenCount: number;
}

interface ChunkOptions {
	maxTokens?: number; // Target chunk size in tokens (~4 chars per token)
	overlap?: number; // Number of overlap tokens between chunks
}

// ─── Main chunker ────────────────────────────────────────────────────────────

export function chunkPaper(
	abstract: string | null,
	fullText: string | null,
	options: ChunkOptions = {},
): Chunk[] {
	const { maxTokens = 384, overlap = 64 } = options;
	const chunks: Chunk[] = [];
	let chunkIndex = 0;

	// 1. Chunk the abstract (always available)
	if (abstract && abstract.trim().length > 0) {
		const abstractChunks = chunkText(abstract, maxTokens, overlap);
		for (const text of abstractChunks) {
			chunks.push({
				content: text,
				section: 'abstract',
				chunkIndex: chunkIndex++,
				tokenCount: estimateTokens(text),
			});
		}
	}

	// 2. Chunk the full text body if available (from PMC open access)
	if (fullText && fullText.trim().length > 0) {
		// Try to split into sections first
		const sections = splitIntoSections(fullText);

		for (const { name, text } of sections) {
			const sectionChunks = chunkText(text, maxTokens, overlap);
			for (const chunkText of sectionChunks) {
				chunks.push({
					content: chunkText,
					section: name,
					chunkIndex: chunkIndex++,
					tokenCount: estimateTokens(chunkText),
				});
			}
		}
	}

	return chunks;
}

// ─── Text splitting ──────────────────────────────────────────────────────────

function chunkText(
	text: string,
	maxTokens: number,
	overlapTokens: number,
): string[] {
	const maxChars = maxTokens * 4; // ~4 chars per token
	const overlapChars = overlapTokens * 4;

	// Clean the text
	const cleaned = text
		.replace(/\s+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	// If the text fits in one chunk, return as-is
	if (cleaned.length <= maxChars) {
		return cleaned.length > 0 ? [cleaned] : [];
	}

	const chunks: string[] = [];
	let start = 0;

	while (start < cleaned.length) {
		let end = start + maxChars;

		// Don't exceed text length
		if (end >= cleaned.length) {
			chunks.push(cleaned.slice(start).trim());
			break;
		}

		// Try to break at sentence boundary (look back from end)
		const searchWindow = cleaned.slice(end - 100, end + 50);
		const sentenceBreak = findBestBreak(searchWindow);

		if (sentenceBreak !== -1) {
			end = end - 100 + sentenceBreak;
		}

		chunks.push(cleaned.slice(start, end).trim());

		// Move forward with overlap
		start = end - overlapChars;
	}

	return chunks.filter((c) => c.length > 0);
}

// ─── Find best sentence boundary ────────────────────────────────────────────

function findBestBreak(text: string): number {
	// Prefer breaking at: period+space, newline, semicolon
	const patterns = [/\.\s/g, /\n/g, /;\s/g, /,\s/g];

	for (const pattern of patterns) {
		let lastMatch = -1;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			lastMatch = match.index + match[0].length;
		}

		if (lastMatch !== -1) return lastMatch;
	}

	// Fall back to any whitespace
	const spaceMatch = text.lastIndexOf(' ');
	return spaceMatch !== -1 ? spaceMatch + 1 : -1;
}

// ─── Section detection ───────────────────────────────────────────────────────
// Attempts to identify common paper sections from full text

interface Section {
	name: string;
	text: string;
}

function splitIntoSections(fullText: string): Section[] {
	// Common section headers in medical papers
	const sectionPattern =
		/^(?:#{1,3}\s*)?(?:\d+\.?\s*)?(introduction|background|methods?|materials?\s*(?:and|&)\s*methods?|results?|discussion|conclusions?|limitations?|findings)\s*$/gim;

	const sections: Section[] = [];
	const matches: { name: string; index: number }[] = [];

	let match: RegExpExecArray | null;
	while ((match = sectionPattern.exec(fullText)) !== null) {
		matches.push({
			name: match[1].toLowerCase().trim(),
			index: match.index,
		});
	}

	// If no sections found, treat as a single "body" section
	if (matches.length === 0) {
		return [{ name: 'body', text: fullText }];
	}

	// Extract text between section headers
	for (let i = 0; i < matches.length; i++) {
		const start = matches[i].index;
		const end =
			i + 1 < matches.length ? matches[i + 1].index : fullText.length;
		const sectionText = fullText.slice(start, end).trim();

		// Remove the header line itself
		const firstNewline = sectionText.indexOf('\n');
		const body =
			firstNewline !== -1
				? sectionText.slice(firstNewline).trim()
				: sectionText;

		if (body.length > 0) {
			sections.push({
				name: normalizeSection(matches[i].name),
				text: body,
			});
		}
	}

	// Include any text before the first section as "introduction"
	if (matches.length > 0 && matches[0].index > 100) {
		const preface = fullText.slice(0, matches[0].index).trim();
		if (preface.length > 0) {
			sections.unshift({ name: 'introduction', text: preface });
		}
	}

	return sections;
}

function normalizeSection(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes('method') || lower.includes('material'))
		return 'methods';
	if (lower.includes('result') || lower.includes('finding')) return 'results';
	if (lower.includes('discuss')) return 'discussion';
	if (lower.includes('conclus')) return 'conclusion';
	if (lower.includes('introduct') || lower.includes('background'))
		return 'introduction';
	if (lower.includes('limitat')) return 'limitations';
	return lower;
}

// ─── Token estimation ────────────────────────────────────────────────────────
// Rough estimate: ~4 characters per token for English medical text

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}
