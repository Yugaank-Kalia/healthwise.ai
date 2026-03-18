// Test endpoint: POST /api/ingest { "query": "omega-3 heart health" }
// Searches PubMed → chunks papers → embeds → stores in Supabase
import { NextRequest, NextResponse } from 'next/server';

import { ingestPapers } from '@/lib/pubmed/ingest';
import { searchAndFetchPapers } from '@/lib/pubmed/pubmed';

export async function POST(req: NextRequest) {
	try {
		const { query, maxResults = 5 } = await req.json();

		if (!query) {
			return NextResponse.json(
				{ error: "Missing 'query' in request body" },
				{ status: 400 },
			);
		}

		// 1. Search PubMed
		const papers = await searchAndFetchPapers(query, {
			maxResults,
			sort: 'relevance',
			filters: ['free full text'],
		});

		if (papers.length === 0) {
			return NextResponse.json({
				message: 'No papers found',
				query,
			});
		}

		// 2. Ingest: chunk → embed → store
		const result = await ingestPapers(papers);

		return NextResponse.json({
			message: 'Ingest complete',
			query,
			papersFound: papers.length,
			...result,
		});
	} catch (error) {
		console.error('Ingest error:', error);
		return NextResponse.json(
			{
				error: 'Ingest pipeline failed',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
