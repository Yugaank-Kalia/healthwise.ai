import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { messages, searchQueries } from '@/src/db/schemas/schema';
import {
	answerStream,
	type OrchestratorStreamResult,
} from '@/lib/pubmed/orchestrator';
import { extractCitations } from '@/lib/llm';
import { auth } from '@/lib/auth';
import { and, count, eq, gte } from 'drizzle-orm';

const DAILY_LIMIT = 10;

export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { query, conversationId, messageId } = await req.json();
	if (!query || !conversationId || !messageId) {
		return NextResponse.json(
			{ error: 'Missing required fields' },
			{ status: 400 },
		);
	}

	// ── Rate limit: n queries per user per day (UTC) ──────────────────────
	const startOfDay = new Date();
	startOfDay.setUTCHours(0, 0, 0, 0);

	const [{ value: queryCount }] = await db
		.select({ value: count() })
		.from(searchQueries)
		.where(
			and(
				eq(searchQueries.userId, session.user.id),
				gte(searchQueries.createdAt, startOfDay),
			),
		);

	// if (queryCount >= DAILY_LIMIT) {
	// 	return NextResponse.json(
	// 		{
	// 			error: `You've reached your daily limit of ${DAILY_LIMIT} queries. Come back tomorrow.`,
	// 		},
	// 		{ status: 429 },
	// 	);
	// }

	const encoder = new TextEncoder();

	const sseStream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(
						encoder.encode(
							`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
						),
					);
				} catch {
					// Client disconnected - keep going so DB gets finalized
				}
			};

			let result: OrchestratorStreamResult;
			try {
				result = await answerStream(query, {
					userId: session.user.id,
					onProgress: (stage) => send('progress', { stage }),
				});
			} catch (err) {
				send('error', { error: String(err) });
				await db
					.update(messages)
					.set({
						content: 'Something went wrong. Please try again.',
						status: 'error',
					})
					.where(
						and(
							eq(messages.id, messageId),
							eq(messages.conversationId, conversationId),
						),
					);
				controller.close();
				return;
			}

			const sources = result.papersUsed.map((p) => ({
				pmid: p.pmid,
				title: p.title,
				authors: p.authors,
				year: p.year,
				doi: p.doi ? `https://doi.org/${p.doi}` : null,
				type: p.publicationType,
				pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`,
			}));

			// Meta event - sources and pipeline info up front
			send('meta', {
				sources,
				cacheHit: result.cacheHit,
				meta: {
					chunksRetrieved: result.meta.chunksRetrieved,
					papersSearched: result.meta.papersSearched,
					papersIngested: result.meta.papersIngested,
				},
			});

			const reader = result.stream.getReader();
			let fullAnswer = '';
			let firstToken = true;

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (firstToken) {
						firstToken = false;
						// Mark as streaming in DB so a reload shows partial content
						db.update(messages)
							.set({ status: 'streaming' })
							.where(
								and(
									eq(messages.id, messageId),
									eq(messages.conversationId, conversationId),
								),
							)
							.catch(() => {});
					}
					fullAnswer += value;
					send('token', { content: value });
				}
			} catch (err) {
				send('error', { error: String(err) });
				await db
					.update(messages)
					.set({
						content: 'Something went wrong. Please try again.',
						status: 'error',
					})
					.where(
						and(
							eq(messages.id, messageId),
							eq(messages.conversationId, conversationId),
						),
					);
				controller.close();
				return;
			} finally {
				reader.releaseLock();
			}

			const citations = extractCitations(fullAnswer, result.papersUsed);
			send('done', { citations });

			const responseTimeMs = Date.now() - result.meta.startTime;

			// Persist to DB and log analytics
			await Promise.all([
				db
					.update(messages)
					.set({
						content: fullAnswer,
						sources: sources.length > 0 ? sources : null,
						citations: citations as unknown[],
						meta: { cacheHit: result.cacheHit, ...result.meta },
						status: 'done',
					})
					.where(
						and(
							eq(messages.id, messageId),
							eq(messages.conversationId, conversationId),
						),
					),
				result.logAnalytics(responseTimeMs),
			]);

			controller.close();
		},
	});

	return new Response(sseStream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
}
