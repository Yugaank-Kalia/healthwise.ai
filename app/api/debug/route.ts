// app/api/debug-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/src/db';
import { isNotNull, sql } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/pubmed/embeddings';
import { nihChunks } from '@/src/db/schemas/schema';

export async function GET(req: NextRequest) {
	const query = 'are seed oils bad for you?';

	// 1. How many chunks exist?
	const totalChunks = await db
		.select({ count: sql<number>`count(*)` })
		.from(nihChunks);

	// 2. How many have embeddings?
	const withEmbeddings = await db
		.select({ count: sql<number>`count(*)` })
		.from(nihChunks)
		.where(isNotNull(nihChunks.embedding));

	// 3. What does a raw embedding look like?
	const sampleChunk = await db
		.select({
			id: nihChunks.id,
			contentPreview: sql<string>`left(${nihChunks.content}, 100)`,
			embeddingLength: sql<number>`array_length(${nihChunks.embedding}::real[], 1)`,
		})
		.from(nihChunks)
		.where(isNotNull(nihChunks.embedding))
		.limit(1);

	// 4. Generate query embedding and check its length
	const queryEmbedding = await generateEmbedding(query);

	// 5. Try raw SQL similarity search (bypass Drizzle)
	let rawResults: any = null;
	let rawError: string | null = null;

	try {
		const vectorStr = `[${queryEmbedding.join(',')}]`;
		rawResults = await db.execute(sql`
        SELECT 
            c.id,
            left(c.content, 100) as preview,
            p.title,
            1 - (c.embedding <=> ${vectorStr}::vector) as similarity
            FROM nih_chunks c
            JOIN nih_papers p ON p.id = c.paper_id
            WHERE c.embedding IS NOT NULL
            ORDER BY c.embedding <=> ${vectorStr}::vector
            LIMIT 5
    `);
	} catch (e) {
		rawError = e instanceof Error ? e.message : String(e);
	}

	return NextResponse.json({
		query: query,
		totalChunks: totalChunks[0]?.count,
		withEmbeddings: withEmbeddings[0]?.count,
		sampleChunk,
		queryEmbeddingLength: queryEmbedding.length,
		rawSearchResults: rawResults,
		rawError,
	});
}
