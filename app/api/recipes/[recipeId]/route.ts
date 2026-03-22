import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { recipes } from '@/src/db/schemas/nutrition-schema';
import { eq } from 'drizzle-orm';

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ recipeId: string }> },
) {
	const { recipeId } = await params;

	const [recipe] = await db
		.select()
		.from(recipes)
		.where(eq(recipes.id, recipeId));

	if (!recipe)
		return NextResponse.json({ error: 'Not found' }, { status: 404 });

	return NextResponse.json(recipe);
}
