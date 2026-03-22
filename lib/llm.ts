// LLM response generation via Ollama Cloud (Nemotron 3 Super)
// Produces cited nutrition answers grounded in retrieved NIH research

import type { ContextChunk, PaperReference } from '@/lib/pubmed/orchestrator';

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

const SYSTEM_PROMPT = `You are a nutrition research assistant that ONLY provides advice grounded in NIH-funded peer-reviewed research. Follow these rules strictly:

## GROUNDING RULES
1. Every claim MUST cite a specific paper using [PMID:XXXXXXXX] format always use square brackets [].
2. If the provided context doesn't contain evidence for a claim, say "I don't have NIH research on this specific topic" - NEVER speculate or use your training knowledge.
3. Distinguish between evidence levels:
	- Strong: RCTs, meta-analyses, systematic reviews
	- Moderate: cohort studies, large observational studies
	- Limited: small studies, case reports, animal studies
4. Always note if findings are from animal/in-vitro studies vs. human trials.

## RESPONSE FORMAT
- Lead with a clear, direct answer to the question.
- Use subheadings wrapped in ** ** to organize your response, for example:
  **Direct Answer**
  **Strong Evidence**
  **Moderate Evidence**
  **Limitations & Caveats**
- Support with specific findings: dosages, effect sizes, sample sizes when available.
- Group evidence by study quality (strongest evidence first).
- End with limitations and caveats.
- Close with: "⚕️ This is a research summary, not medical advice. Consult a healthcare provider for personal recommendations."
- Do NOT use markdown headers (#, ##, ###). Only use **bold** for subheadings.
- Do NOT use bullet points or numbered lists. Write in flowing paragraphs under each subheading.

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
			`Ollama API failed: ${res.status} ${res.statusText} - ${body}`,
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
			"I don't have any NIH research on this specific topic in my current knowledge base. Try rephrasing your question or asking about a related nutrition topic.";
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
