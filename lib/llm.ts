// LLM response generation via Ollama Cloud (Nemotron 3 Super)
// Produces cited nutrition answers grounded in retrieved NIH research

import type { ContextChunk, PaperReference } from '@/lib/pubmed/orchestrator';

// ─── Config ──────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY ?? '';
const MODEL = process.env.LLM_MODEL ?? 'nemotron-3-super';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedResponse {
	answer: string;
	citations: Citation[];
}

export interface Citation {
	pmid: string;
	title: string;
	year: number | null;
	doi: string | null;
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a nutrition research assistant that ONLY provides advice grounded in NIH-funded peer-reviewed research. Follow these rules strictly:

## GROUNDING RULES
1. Every claim MUST cite a specific paper using [PMID:XXXXXXXX] format.
2. If the provided context doesn't contain evidence for a claim, say "I don't have NIH research on this specific topic" — NEVER speculate or use your training knowledge.
3. Distinguish between evidence levels:
   - Strong: RCTs, meta-analyses, systematic reviews
   - Moderate: cohort studies, large observational studies
   - Limited: small studies, case reports, animal studies
4. Always note if findings are from animal/in-vitro studies vs. human trials.

## RESPONSE FORMAT
- Lead with a clear, direct answer to the question.
- Support with specific findings: dosages, effect sizes, sample sizes when available.
- Group evidence by study quality (strongest evidence first).
- End with limitations and caveats.
- Close with: "⚕️ This is a research summary, not medical advice. Consult a healthcare provider for personal recommendations."

## SAFETY
- Never recommend specific supplement dosages as personal advice.
- Flag contraindications or drug interactions mentioned in the research.
- For serious conditions, always recommend consulting a healthcare provider.
- If research is conflicting, present both sides fairly.

## CONTEXT
The following are chunks from NIH/PubMed papers retrieved for this query. Use ONLY this information:`;

// ─── Build the user message with context ─────────────────────────────────────

function buildUserMessage(query: string, context: ContextChunk[]): string {
	const contextBlock = context
		.map(
			(chunk, i) =>
				`--- Paper ${i + 1} ---
PMID: ${chunk.pmid}
Title: ${chunk.paperTitle}
Year: ${chunk.year ?? 'Unknown'}
Section: ${chunk.section ?? 'Unknown'}
Relevance: ${(chunk.similarity * 100).toFixed(1)}%

${chunk.content}`,
		)
		.join('\n\n');

	return `${contextBlock}

---

User question: ${query}

Provide a thorough, cited answer based ONLY on the papers above.`;
}

// ─── Generate response ───────────────────────────────────────────────────────

export async function generateResponse(
	query: string,
	context: ContextChunk[],
	papers: PaperReference[],
): Promise<GeneratedResponse> {
	if (context.length === 0) {
		return {
			answer: "I don't have any NIH research on this specific topic in my current knowledge base. Try rephrasing your question or asking about a related nutrition topic.",
			citations: [],
		};
	}

	const userMessage = buildUserMessage(query, context);

	const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OLLAMA_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: userMessage },
			],
			stream: false,
			options: {
				temperature: 0.3, // Low for factual accuracy
				top_p: 0.9,
				num_ctx: 32768, // Enough for system prompt + context + response
			},
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Ollama API failed: ${res.status} ${res.statusText} — ${body}`,
		);
	}

	const data = await res.json();
	const rawAnswer: string = data.message?.content ?? '';

	// Extract cited PMIDs from the response
	const citations = extractCitations(rawAnswer, papers);

	return {
		answer: rawAnswer,
		citations,
	};
}

// ─── Extract citations from response ─────────────────────────────────────────
// Finds all [PMID:XXXXXXXX] references in the answer and maps them
// to paper metadata

function extractCitations(
	answer: string,
	papers: PaperReference[],
): Citation[] {
	const pmidPattern = /\[PMID[:\s]*(\d+)\]/g;
	const citedPmids = new Set<string>();

	let match: RegExpExecArray | null;
	while ((match = pmidPattern.exec(answer)) !== null) {
		citedPmids.add(match[1]);
	}

	const paperMap = new Map(papers.map((p) => [p.pmid, p]));

	return Array.from(citedPmids)
		.map((pmid) => {
			const paper = paperMap.get(pmid);
			if (!paper) return null;
			return {
				pmid: paper.pmid,
				title: paper.title,
				year: paper.year,
				doi: paper.doi,
			};
		})
		.filter((c): c is Citation => c !== null);
}
