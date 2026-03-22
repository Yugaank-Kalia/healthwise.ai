import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import {
	messages,
	messageFeedback,
	conversations,
} from '@/src/db/schemas/schema';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';

type Params = { params: Promise<{ messageId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { messageId } = await params;
	const { value } = await req.json();

	if (value !== 'up' && value !== 'down') {
		return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
	}

	const [msg] = await db
		.select({ conversationId: messages.conversationId })
		.from(messages)
		.where(eq(messages.id, messageId))
		.limit(1);

	if (!msg)
		return NextResponse.json(
			{ error: 'Message not found' },
			{ status: 404 },
		);

	const [owned] = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(
			and(
				eq(conversations.id, msg.conversationId),
				eq(conversations.userId, session.user.id),
			),
		)
		.limit(1);

	if (!owned)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const [feedback] = await db
		.insert(messageFeedback)
		.values({
			messageId,
			userId: session.user.id,
			value,
		})
		.onConflictDoUpdate({
			target: [messageFeedback.messageId, messageFeedback.userId],
			set: { value },
		})
		.returning();

	return NextResponse.json({ value: feedback.value }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { messageId } = await params;

	await db
		.delete(messageFeedback)
		.where(
			and(
				eq(messageFeedback.messageId, messageId),
				eq(messageFeedback.userId, session.user.id),
			),
		);

	return new NextResponse(null, { status: 204 });
}
