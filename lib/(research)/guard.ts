const OLLAMA_BASE_URL = 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

export async function isResearchQuery(query: string): Promise<boolean> {
	const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OLLAMA_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'gemma3:4b',
			messages: [
				{
					role: 'user',
					content: `Classify if this question is related to biomedical research, including pharmacology, disease mechanisms, clinical trials, genomics, neuroscience, immunology, molecular biology, biochemistry, pathophysiology, drug discovery, cancer biology, infectious disease, or any scientific/medical topic that could be investigated through peer-reviewed research. Answer ONLY "yes" or "no".

					Question: "${query}"`,
				},
			],
			stream: false,
			options: {
				temperature: 0,
				num_predict: 3,
			},
		}),
	});

	if (!res.ok) return true; // If guard fails, let the query through

	const data = await res.json();
	const answer = (data.message?.content ?? '').toLowerCase().trim();

	return answer.startsWith('yes');
}
