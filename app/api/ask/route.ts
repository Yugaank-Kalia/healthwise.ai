import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { messages } from '@/src/db/schemas/schema';
import { answer } from '@/lib/pubmed/orchestrator';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';

async function processLLM(
	query: string,
	conversationId: string,
	messageId: string,
) {
	try {
		const result = await answer(query, {});

		const sources = result.papersUsed.map((p) => ({
			pmid: p.pmid,
			title: p.title,
			authors: p.authors,
			year: p.year,
			doi: p.doi ? `https://doi.org/${p.doi}` : null,
			type: p.publicationType,
			pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`,
		}));

		await db
			.update(messages)
			.set({
				content: result.answer,
				sources: sources.length > 0 ? sources : null,
				citations: result.citations as unknown[],
				meta: { cacheHit: result.cacheHit, ...result.meta },
				status: 'done',
			})
			.where(
				and(
					eq(messages.id, messageId),
					eq(messages.conversationId, conversationId),
				),
			);
	} catch (error) {
		console.error('processLLM error:', error);
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
	}
}

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

	// Fire and forget - don't await, server completes regardless of client connection
	processLLM(query, conversationId, messageId);

	return NextResponse.json({ status: 'accepted' }, { status: 202 });
}
