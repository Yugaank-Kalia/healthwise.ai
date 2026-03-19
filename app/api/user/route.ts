import { auth } from '@/lib/auth';
import { db } from '@/src/db';
import { account } from '@/src/db/schemas/auth-schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session)
		return Response.json({ error: 'Unauthorized' }, { status: 401 });

	const credAccount = await db
		.select()
		.from(account)
		.where(
			and(
				eq(account.userId, session.user.id),
				eq(account.providerId, 'credential'),
			),
		)
		.limit(1);

	return Response.json({ hasPassword: credAccount.length > 0 });
}
