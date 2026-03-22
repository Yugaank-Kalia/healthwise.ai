import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { conversations } from '@/src/db/schemas/nutrition-schema';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;
	const { title } = await req.json();

	const [updated] = await db
		.update(conversations)
		.set({ title, updatedAt: new Date() })
		.where(
			and(
				eq(conversations.id, id),
				eq(conversations.userId, session.user.id),
			),
		)
		.returning();

	if (!updated)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;

	await db
		.delete(conversations)
		.where(
			and(
				eq(conversations.id, id),
				eq(conversations.userId, session.user.id),
			),
		);

	return new NextResponse(null, { status: 204 });
}
