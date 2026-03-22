import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { conversations, messages } from '@/src/db/schemas/nutrition-schema';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';

type Params = { params: Promise<{ id: string; messageId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id, messageId } = await params;

	const owned = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(
			and(
				eq(conversations.id, id),
				eq(conversations.userId, session.user.id),
			),
		)
		.limit(1);

	if (!owned.length)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const [msg] = await db
		.select()
		.from(messages)
		.where(and(eq(messages.id, messageId), eq(messages.conversationId, id)))
		.limit(1);

	if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	return NextResponse.json(msg);
}

export async function PATCH(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id, messageId } = await params;

	// Verify the conversation belongs to this user
	const owned = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(
			and(
				eq(conversations.id, id),
				eq(conversations.userId, session.user.id),
			),
		)
		.limit(1);

	if (!owned.length)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const body = await req.json();

	const [updated] = await db
		.update(messages)
		.set(body)
		.where(and(eq(messages.id, messageId), eq(messages.conversationId, id)))
		.returning();

	if (!updated)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	return NextResponse.json(updated);
}
