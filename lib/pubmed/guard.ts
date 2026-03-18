const OLLAMA_BASE_URL = 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

export async function isNutritionQuery(query: string): Promise<boolean> {
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
					content: `Classify if this question is about nutrition, food, diet, supplements, health conditions related to diet, or exercise/fitness. Answer ONLY "yes" or "no".

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
