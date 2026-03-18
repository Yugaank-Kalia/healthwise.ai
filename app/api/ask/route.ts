// Returns a cited, LLM-generated answer grounded in NIH research

import { NextRequest, NextResponse } from 'next/server';
import { answer } from '@/lib/pubmed/orchestrator';

export async function POST(req: NextRequest) {
	try {
		const { query, userId } = await req.json();

		if (!query) {
			return NextResponse.json(
				{ error: "Missing 'query' in request body" },
				{ status: 400 },
			);
		}

		const result = await answer(query, { userId });

		return NextResponse.json({
			answer: result.answer,
			citations: result.citations,
			sources: result.papersUsed.map((p) => ({
				pmid: p.pmid,
				title: p.title,
				authors: p.authors,
				year: p.year,
				doi: p.doi ? `https://doi.org/${p.doi}` : null,
				type: p.publicationType,
				pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`,
			})),
			meta: {
				cacheHit: result.cacheHit,
				...result.meta,
			},
		});
	} catch (error) {
		console.error('Ask error:', error);
		return NextResponse.json(
			{
				error: 'Failed to process question',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
