// Test endpoint: GET /api/search?q=does+vitamin+D+help+with+depression
import { searchChunks } from '@/lib/pubmed/search';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
	const query = req.nextUrl.searchParams.get('q');

	if (!query) {
		return NextResponse.json(
			{ error: 'Missing ?q= parameter' },
			{ status: 400 },
		);
	}

	try {
		const results = await searchChunks(query, {
			topK: 5,
			threshold: 0.5, // Lower threshold for testing
		});

		return NextResponse.json({
			query,
			count: results.length,
			results: results.map((r) => ({
				similarity: r.similarity.toFixed(4),
				section: r.section,
				paper: {
					title: r.paper.title,
					pmid: r.paper.pmid,
					year: r.paper.year,
					type: r.paper.publicationType,
				},
				contentPreview: r.content.slice(0, 200) + '...',
			})),
		});
	} catch (error) {
		console.error('Search error:', error);
		return NextResponse.json(
			{
				error: 'Search failed',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
