import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { conversations } from '@/src/db/schemas/nutrition-schema';
import { auth } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const rows = await db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, session.user.id))
		.orderBy(desc(conversations.updatedAt));

	return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { title } = await req.json();

	const [convo] = await db
		.insert(conversations)
		.values({ userId: session.user.id, title: title || 'New Chat' })
		.returning();

	return NextResponse.json(convo, { status: 201 });
}
