import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { conversations, messages } from '@/src/db/schemas/schema';
import { auth } from '@/lib/auth';
import { and, eq, asc } from 'drizzle-orm';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;

	const owned = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
		.limit(1);

	if (!owned.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.conversationId, id))
		.orderBy(asc(messages.order));

	return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;
	const body = await req.json();

	await db
		.update(conversations)
		.set({ updatedAt: new Date() })
		.where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));

	const [msg] = await db
		.insert(messages)
		.values({ conversationId: id, ...body })
		.returning();

	return NextResponse.json(msg, { status: 201 });
}
