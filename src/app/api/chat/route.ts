import { OpenAIStream, OpenAIStreamPayload } from '@/lib/stream';
import { NextResponse } from 'next/server';

if (!process.env.OPENAI_API_KEY) {
	throw new Error('Missing API KEY from OpenAI');
}

export const config = {
	runtime: 'edge',
};

export async function POST(req: Request): Promise<Response> {
	const { prompt } = (await req.json()) as {
		prompt?: string;
	};

	if (!prompt) {
		return new NextResponse('No prompt in the request', { status: 400 });
	}

	const payload: OpenAIStreamPayload = {
		model: 'gpt-3.5-turbo',
		messages: [{ role: 'user', content: prompt }],
		temperature: 0.7,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
		max_tokens: 1000,
		stream: true,
		n: 1,
	};

	const stream = await OpenAIStream(payload);
	return new NextResponse(stream);
}
