import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs";
import { Configuration, OpenAIApi } from "openai";

export async function POST(req: Request) {
	try {
		const { prompt } = await req.json();
		const user = currentUser();

		if (!user) return new NextResponse("Unauthorized", { status: 401 });

		const configuration = new Configuration({
			apiKey: process.env.OPEN_AI_KEY,
		});
		const openai = new OpenAIApi(configuration);

		const gpt = await openai.createChatCompletion({
			model: "gpt-3.5-turbo",
			max_tokens: 500,
			temperature: 1,
			messages: [
				{
					role: "system",
					content:
						"You are not a doctor but can try providing solutions for medical ailments",
				},
				{
					role: "user",
					content: prompt,
				},
			],
		});

		const response = gpt.data.choices[0]?.message?.content;

		return NextResponse.json(response);
	} catch (error) {
		return new NextResponse("Internal Error", { status: 500 });
	}
}
