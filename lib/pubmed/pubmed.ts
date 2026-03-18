// Docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/

const API_KEY = process.env.NCBI_API_KEY ?? '';
const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const TOOL_NAME = 'healthwise-rag';
const TOOL_EMAIL = process.env.CONTACT_EMAIL ?? '';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PubMedPaper {
	pmid: string;
	pmcId: string | null;
	title: string;
	abstract: string | null;
	authors: string;
	journal: string | null;
	year: number | null;
	doi: string | null;
	publicationType: string | null;
}

interface ESearchResult {
	esearchresult: {
		count: string;
		retmax: string;
		idlist: string[];
		querytranslation?: string;
	};
}

// ─── Helper: Build common params ─────────────────────────────────────────────

function commonParams(): Record<string, string> {
	const params: Record<string, string> = {
		tool: TOOL_NAME,
	};
	if (TOOL_EMAIL) params.email = TOOL_EMAIL;
	if (API_KEY) params.api_key = API_KEY;
	return params;
}

// ─── Helper: Rate limiting (3 req/s without key) ────────────────────────────

let lastRequestTime = 0;
const MIN_INTERVAL_MS = API_KEY ? 100 : 340; // ~3/s without key, ~10/s with

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;
	if (elapsed < MIN_INTERVAL_MS) {
		await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
	}
	lastRequestTime = Date.now();
	return fetch(url);
}

// ─── 1. Search PubMed ────────────────────────────────────────────────────────

export async function searchPubMed(
	query: string,
	options: {
		maxResults?: number;
		sort?: 'relevance' | 'pub_date';
		filters?: string[];
		minDate?: string; // YYYY/MM/DD
		maxDate?: string;
	} = {},
): Promise<string[]> {
	const {
		maxResults = 15,
		sort = 'relevance',
		filters = [],
		minDate,
		maxDate,
	} = options;

	// Build the full query with filters
	let fullQuery = query;
	if (filters.length > 0) {
		const filterStr = filters.map((f) => `${f}[filter]`).join(' AND ');
		fullQuery += ` AND (${filterStr})`;
	}

	const params = new URLSearchParams({
		db: 'pubmed',
		term: fullQuery,
		retmax: String(maxResults),
		sort,
		retmode: 'json',
		...commonParams(),
	});

	if (minDate) params.set('mindate', minDate);
	if (maxDate) params.set('maxdate', maxDate);
	if (minDate || maxDate) params.set('datetype', 'pdat');

	const res = await rateLimitedFetch(`${BASE_URL}/esearch.fcgi?${params}`);

	if (!res.ok) {
		throw new Error(
			`PubMed search failed: ${res.status} ${res.statusText}`,
		);
	}

	const data: ESearchResult = await res.json();
	return data.esearchresult.idlist;
}

// ─── 2. Fetch paper details ──────────────────────────────────────────────────

export async function fetchPapers(pmids: string[]): Promise<PubMedPaper[]> {
	if (pmids.length === 0) return [];

	const params = new URLSearchParams({
		db: 'pubmed',
		id: pmids.join(','),
		retmode: 'xml',
		...commonParams(),
	});

	const res = await rateLimitedFetch(`${BASE_URL}/efetch.fcgi?${params}`);

	if (!res.ok) {
		throw new Error(`PubMed fetch failed: ${res.status} ${res.statusText}`);
	}

	const xml = await res.text();
	return parsePubMedXml(xml);
}

// ─── 3. Combined search + fetch ──────────────────────────────────────────────

export async function searchAndFetchPapers(
	query: string,
	options: {
		maxResults?: number;
		sort?: 'relevance' | 'pub_date';
		filters?: string[];
	} = {},
): Promise<PubMedPaper[]> {
	const pmids = await searchPubMed(query, options);

	if (pmids.length === 0) return [];

	return fetchPapers(pmids);
}

// ─── 4. XML Parser ───────────────────────────────────────────────────────────
// PubMed efetch returns XML. We parse it without external dependencies
// using regex-based extraction (the XML is well-structured and predictable).

function parsePubMedXml(xml: string): PubMedPaper[] {
	const papers: PubMedPaper[] = [];

	// Split into individual articles
	const articleMatches = xml.match(
		/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g,
	);
	if (!articleMatches) return papers;

	for (const articleXml of articleMatches) {
		try {
			const paper = parseArticle(articleXml);
			if (paper) papers.push(paper);
		} catch (e) {
			// Skip malformed articles
			console.warn('Failed to parse PubMed article:', e);
		}
	}

	return papers;
}

function parseArticle(xml: string): PubMedPaper | null {
	const pmid = extractTag(xml, 'PMID');
	if (!pmid) return null;

	// Title
	const title = extractTag(xml, 'ArticleTitle') ?? 'Untitled';

	// Abstract — may have multiple AbstractText sections
	const abstractParts: string[] = [];
	const abstractMatches = xml.match(
		/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g,
	);
	if (abstractMatches) {
		for (const match of abstractMatches) {
			const labelMatch = match.match(/Label="([^"]+)"/);
			const textMatch = match.match(
				/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/,
			);
			if (textMatch?.[1]) {
				const cleanText = stripTags(textMatch[1]);
				if (labelMatch?.[1]) {
					abstractParts.push(`${labelMatch[1]}: ${cleanText}`);
				} else {
					abstractParts.push(cleanText);
				}
			}
		}
	}

	// Authors
	const authors: string[] = [];
	const authorMatches = xml.match(/<Author[\s\S]*?<\/Author>/g);
	if (authorMatches) {
		for (const authorXml of authorMatches) {
			const lastName = extractTag(authorXml, 'LastName');
			const initials = extractTag(authorXml, 'Initials');
			if (lastName) {
				authors.push(initials ? `${lastName} ${initials}` : lastName);
			}
		}
	}

	// Journal
	const journal =
		extractTag(xml, 'Title') ?? extractTag(xml, 'ISOAbbreviation');

	// Year — try multiple locations
	const year =
		extractTag(xml, 'Year') ??
		(() => {
			const medlineMatch = xml.match(/<MedlineDate>(\d{4})/);
			return medlineMatch?.[1] ?? null;
		})();

	// DOI
	const doiMatch = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
	const doi = doiMatch?.[1] ?? null;

	// PMC ID
	const pmcMatch = xml.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/);
	const pmcId = pmcMatch?.[1] ?? null;

	// Publication type
	const pubTypeMatch = xml.match(
		/<PublicationType[^>]*>([^<]+)<\/PublicationType>/,
	);
	const publicationType = pubTypeMatch?.[1] ?? null;

	return {
		pmid,
		pmcId,
		title: stripTags(title),
		abstract: abstractParts.length > 0 ? abstractParts.join('\n\n') : null,
		authors: authors.join(', '),
		journal,
		year: year ? parseInt(year, 10) : null,
		doi,
		publicationType,
	};
}

// ─── 5. Utility helpers ──────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | null {
	const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
	return match?.[1]?.trim() ?? null;
}

function stripTags(text: string): string {
	return text.replace(/<[^>]+>/g, '').trim();
}

// ─── 6. Query builder helpers ────────────────────────────────────────────────
// Helpers for building well-formed PubMed queries

export function buildNutritionQuery(
	keywords: string[],
	options: {
		meshTerms?: string[];
		studyTypes?: string[];
		humansOnly?: boolean;
	} = {},
): string {
	const { meshTerms = [], studyTypes = [], humansOnly = true } = options;

	const parts: string[] = [];

	// Add MeSH terms with proper tagging
	for (const term of meshTerms) {
		parts.push(`${term}[MeSH Terms]`);
	}

	// Add keywords (searches all fields)
	if (keywords.length > 0) {
		parts.push(`(${keywords.join(' AND ')})`);
	}
	if (humansOnly) {
		parts.push('humans[MeSH Terms]');
	}
	return parts.join(' AND ');
}
