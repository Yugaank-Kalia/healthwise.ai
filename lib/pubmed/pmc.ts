// Only works for papers with a PMC ID (open access subset)
// Fetch full text from PubMed Central (PMC) Open Access articles

const TOOL_NAME = 'healthwise-rag';
const API_KEY = process.env.NCBI_API_KEY ?? '';
const TOOL_EMAIL = process.env.CONTACT_EMAIL ?? '';
const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PMCFullText {
	pmcId: string;
	sections: PMCSection[];
	rawText: string; // All sections combined
}

export interface PMCSection {
	name: string;
	text: string;
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_INTERVAL_MS = API_KEY ? 100 : 340;

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;
	if (elapsed < MIN_INTERVAL_MS) {
		await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
	}
	lastRequestTime = Date.now();
	return fetch(url);
}

// ─── Fetch full text for a single PMC article ────────────────────────────────

export async function fetchPMCFullText(
	pmcId: string,
): Promise<PMCFullText | null> {
	// Strip "PMC" prefix if present
	const numericId = pmcId.replace(/^PMC/i, '');

	const params = new URLSearchParams({
		db: 'pmc',
		id: numericId,
		retmode: 'xml',
		tool: TOOL_NAME,
	});

	if (TOOL_EMAIL) params.set('email', TOOL_EMAIL);
	if (API_KEY) params.set('api_key', API_KEY);

	try {
		const res = await rateLimitedFetch(`${BASE_URL}/efetch.fcgi?${params}`);

		if (!res.ok) {
			console.warn(`PMC fetch failed for ${pmcId}: ${res.status}`);
			return null;
		}

		const xml = await res.text();

		// Check if we got actual article content
		if (!xml.includes('<body>') && !xml.includes('<body ')) {
			// No full text available (might be metadata only)
			return null;
		}

		const sections = parsePMCBody(xml);

		if (sections.length === 0) return null;

		return {
			pmcId,
			sections,
			rawText: sections.map((s) => s.text).join('\n\n'),
		};
	} catch (error) {
		console.warn(`PMC fetch error for ${pmcId}:`, error);
		return null;
	}
}

// ─── Fetch full text for multiple articles ───────────────────────────────────

export async function fetchMultiplePMCFullTexts(
	pmcIds: string[],
): Promise<Map<string, PMCFullText>> {
	const results = new Map<string, PMCFullText>();

	for (const pmcId of pmcIds) {
		const fullText = await fetchPMCFullText(pmcId);
		if (fullText) {
			results.set(pmcId, fullText);
		}
	}

	return results;
}

// ─── Parse PMC XML body ──────────────────────────────────────────────────────

function parsePMCBody(xml: string): PMCSection[] {
	const sections: PMCSection[] = [];

	// Extract the <body> content
	const bodyMatch = xml.match(/<body[\s>][\s\S]*?<\/body>/);
	if (!bodyMatch) return sections;

	const body = bodyMatch[0];

	// Try to extract named sections first
	const sectionPattern = /<sec[\s>][\s\S]*?<\/sec>/g;
	const topLevelSections = extractTopLevelSections(body);

	if (topLevelSections.length > 0) {
		for (const sec of topLevelSections) {
			const title = extractSectionTitle(sec);
			const text = extractTextContent(sec);

			if (text.length > 50) {
				// Skip very short sections
				sections.push({
					name: normalizeSectionName(title),
					text: cleanText(text),
				});
			}
		}
	} else {
		// No named sections - extract all paragraphs as "body"
		const text = extractTextContent(body);
		if (text.length > 50) {
			sections.push({
				name: 'body',
				text: cleanText(text),
			});
		}
	}

	return sections;
}

// ─── Extract top-level sections ──────────────────────────────────────────────
// PMC XML has nested <sec> tags. We want only the top-level ones.

function extractTopLevelSections(body: string): string[] {
	const sections: string[] = [];
	let depth = 0;
	let currentStart = -1;

	// Simple state machine to find top-level <sec> tags
	const tagPattern = /<\/?sec[\s>\/]/g;
	let match: RegExpExecArray | null;

	// Reset lastIndex
	tagPattern.lastIndex = 0;

	while ((match = tagPattern.exec(body)) !== null) {
		const isClosing = match[0].startsWith('</');

		if (!isClosing) {
			if (depth === 0) {
				currentStart = match.index;
			}
			depth++;
		} else {
			depth--;
			if (depth === 0 && currentStart !== -1) {
				// Find the actual end of </sec>
				const closeEnd = body.indexOf('>', match.index) + 1;
				sections.push(body.slice(currentStart, closeEnd));
				currentStart = -1;
			}
		}
	}

	return sections;
}

// ─── Extract section title ───────────────────────────────────────────────────

function extractSectionTitle(sectionXml: string): string {
	const titleMatch = sectionXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
	if (!titleMatch) return 'untitled';
	return stripTags(titleMatch[1]).trim().toLowerCase();
}

// ─── Extract text content ────────────────────────────────────────────────────
// Pulls text from <p> tags, ignoring tables, figures, and formulas

function extractTextContent(xml: string): string {
	const paragraphs: string[] = [];

	// Match all <p> tags (including nested content)
	const pPattern = /<p[\s>][\s\S]*?<\/p>/g;
	let match: RegExpExecArray | null;

	while ((match = pPattern.exec(xml)) !== null) {
		const text = stripTags(match[0]);
		if (text.trim().length > 0) {
			paragraphs.push(text.trim());
		}
	}

	return paragraphs.join('\n\n');
}

// ─── Normalize section names ─────────────────────────────────────────────────

function normalizeSectionName(title: string): string {
	const lower = title.toLowerCase();

	if (lower.includes('introduction') || lower.includes('background'))
		return 'introduction';
	if (lower.includes('method') || lower.includes('material'))
		return 'methods';
	if (lower.includes('result') || lower.includes('finding')) return 'results';
	if (lower.includes('discussion')) return 'discussion';
	if (lower.includes('conclusion')) return 'conclusion';
	if (lower.includes('limitation')) return 'limitations';
	if (lower.includes('abstract') || lower.includes('summary'))
		return 'abstract';
	if (lower.includes('supplementar')) return 'supplementary';
	if (lower.includes('acknowledg')) return 'acknowledgments';
	if (lower.includes('reference') || lower.includes('bibliograph'))
		return 'references';

	return lower || 'body';
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function stripTags(text: string): string {
	return text
		.replace(/<xref[^>]*>[\s\S]*?<\/xref>/g, '') // Remove citation refs
		.replace(/<ext-link[^>]*>[\s\S]*?<\/ext-link>/g, '') // Remove links
		.replace(/<[^>]+>/g, '') // Remove all remaining tags
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&#x[\da-fA-F]+;/g, '') // Remove hex entities
		.replace(/&#\d+;/g, '') // Remove numeric entities
		.trim();
}

function cleanText(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
