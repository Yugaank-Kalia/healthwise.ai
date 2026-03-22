// app/api/pubmed/search/route.ts
// Test endpoint: GET /api/pubmed/search?q=omega-3+heart+health
import { NextRequest, NextResponse } from 'next/server';
import {
	searchAndFetchPapers,
	buildNutritionQuery,
} from '@/lib/(nutrition)/pubmed';

export async function GET(req: NextRequest) {
	const query = req.nextUrl.searchParams.get('q');

	if (!query) {
		return NextResponse.json(
			{ error: 'Missing ?q= parameter' },
			{ status: 400 },
		);
	}

	try {
		// Build an optimized PubMed query
		// For a real app, you'd use an LLM to extract MeSH terms.
		// For now, we search directly with the user's keywords.
		const papers = await searchAndFetchPapers(query, {
			maxResults: 10,
			sort: 'relevance',
			filters: ['free full text'], // Only OA papers we can access in full
		});

		return NextResponse.json({
			query,
			count: papers.length,
			papers: papers.map((p) => ({
				pmid: p.pmid,
				pmcId: p.pmcId,
				title: p.title,
				authors: p.authors,
				journal: p.journal,
				year: p.year,
				doi: p.doi,
				publicationType: p.publicationType,
				abstractPreview: p.abstract?.slice(0, 200) + '...',
			})),
		});
	} catch (error) {
		console.error('PubMed search error:', error);
		return NextResponse.json(
			{ error: 'PubMed search failed' },
			{ status: 500 },
		);
	}
}
