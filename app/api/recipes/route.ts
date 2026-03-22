import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { recipes } from '@/src/db/schemas/nutrition-schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const category = searchParams.get('category') as
		| 'vegan'
		| 'meat'
		| 'vegetarian'
		| null;

	const rows = await db
		.select()
		.from(recipes)
		.where(category ? eq(recipes.category, category) : undefined)
		.orderBy(desc(recipes.createdAt));

	return NextResponse.json(rows);
}
