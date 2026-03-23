// LLM response generation via Ollama Cloud
// Produces cited biomedical research answers grounded in retrieved PubMed research

import type {
	ContextChunk,
	PaperReference,
} from '@/lib/(research)/orchestrator';

// ─── Config ──────────────────────────────────────────────────────────────────

const MODEL = 'gemma3:27b';
const OLLAMA_BASE_URL = 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

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

const SYSTEM_PROMPT = `You are a biomedical research assistant that ONLY provides information grounded in peer-reviewed research from PubMed and PubMed Central. Follow these rules strictly:

## GROUNDING RULES
1. Every claim MUST cite a specific paper using [PMID:XXXXXXXX] format.
2. If the provided context doesn't contain evidence for a claim, say "I don't have research on this specific topic" — NEVER speculate or use your training knowledge.
3. Distinguish between evidence levels:
	- Strong: RCTs, meta-analyses, systematic reviews
	- Moderate: cohort studies, large observational studies
	- Limited: small studies, case reports, animal/in-vitro studies
	4. Always note if findings are from animal/in-vitro studies vs. human trials.
5. Note the phase of any clinical trials mentioned (Phase I/II/III/IV).

## RESPONSE FORMAT
- Lead with a clear, direct answer to the question.
- Use subheadings wrapped in ** ** to organize your response.
- Support with specific findings: mechanisms, dosages, effect sizes, sample sizes, p-values when available.
- Group evidence by study quality (strongest evidence first).
- End with limitations, knowledge gaps, and directions for future research.
- Close with: "🔬 This is a research summary, not clinical guidance. Consult relevant specialists for clinical decisions."
- Do NOT use markdown headers (#, ##, ###). Only use **bold** for subheadings.
- Do NOT use bullet points or numbered lists. Write in flowing paragraphs under each subheading.

## SAFETY
- Never provide clinical recommendations or treatment plans.
- Flag any safety concerns, contraindications, or adverse effects mentioned in the research.
- For drug-related queries, always note regulatory approval status if mentioned.
- If research is conflicting, present both sides fairly.

## FOLLOW-UP DIRECTIONS
After your main answer, add a section:
**Related Research Directions**
Suggest exactly 3 follow-up questions the user could ask to go deeper into this topic. Each should explore a different angle — a mechanism, a clinical application, or a related condition/pathway. Format them as plain text questions, one per line, prefixed with →.

## CONTEXT
The following are chunks from PubMed/PMC papers retrieved for this query. Use ONLY this information:`;

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
			answer: "I don't have any PubMed research on this specific topic in my current knowledge base. Try rephrasing your question or asking about a related biomedical topic.",
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
				temperature: 0.3,
				top_p: 0.9,
				num_ctx: 32768,
			},
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Ollama API failed: ${res.status} ${res.statusText} - ${body}`,
		);
	}

	const data = await res.json();
	const rawAnswer: string = data.message?.content ?? '';

	const citations = extractCitations(rawAnswer, papers);

	return {
		answer: rawAnswer,
		citations,
	};
}

// ─── Extract citations from response ─────────────────────────────────────────
// Finds all [PMID:XXXXXXXX] references in the answer and maps them
// to paper metadata

export function extractCitations(
	answer: string,
	papers: PaperReference[],
): Citation[] {
	const pmidPattern = /[\[({]?PMID[:\s]*(\d+)[\])}]?/g;
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

// ─── Streaming response ───────────────────────────────────────────────────────

export async function generateResponseStream(
	query: string,
	context: ContextChunk[],
	papers: PaperReference[],
): Promise<{ stream: ReadableStream<string>; papers: PaperReference[] }> {
	if (context.length === 0) {
		const fallback =
			"I don't have any PubMed research on this specific topic in my current knowledge base. Try rephrasing your question or asking about a related biomedical topic.";
		return {
			stream: new ReadableStream<string>({
				start(controller) {
					controller.enqueue(fallback);
					controller.close();
				},
			}),
			papers,
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
			stream: true,
			options: {
				temperature: 0.3,
				top_p: 0.9,
				num_ctx: 32768,
			},
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Ollama API failed: ${res.status} ${res.statusText} - ${body}`,
		);
	}

	const responseBody = res.body!;

	const stream = new ReadableStream<string>({
		async start(controller) {
			const reader = responseBody.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const json = JSON.parse(line);
							if (json.message?.content) {
								controller.enqueue(json.message.content);
							}
							if (json.done) {
								controller.close();
								return;
							}
						} catch {
							// skip malformed line
						}
					}
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			} finally {
				reader.releaseLock();
			}
		},
	});

	return { stream, papers };
}
