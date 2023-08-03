"use client";

import { useCompletion } from "ai/react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatForm } from "./components/chat-form";
import ChatHeader from "./components/chat-header";
import ChatMessages from "./components/chat-messages";
import { ChatMessageProps } from "./components/chat-message";

const ChatClient = () => {
	const router = useRouter();
	const [messages, setMessages] = useState<ChatMessageProps[]>([]);

	const { input, isLoading, handleInputChange, handleSubmit, setInput } =
		useCompletion({
			api: `/api/chat`,
			onFinish(_prompt, completion) {
				const systemMessage: ChatMessageProps = {
					role: "assistant",
					content: completion,
				};

				setMessages((current) => [...current, systemMessage]);
				setInput("");

				router.refresh();
			},
		});

	const onSubmit = (e: FormEvent<HTMLFormElement>) => {
		const userMessage: ChatMessageProps = {
			role: "user",
			content: input,
		};

		console.log(userMessage);

		setMessages((current) => [...current, userMessage]);
		handleSubmit(e);
	};

	return (
		<div className='flex flex-col h-full p-4 space-y-2'>
			<ChatHeader />
			<ChatMessages isLoading={isLoading} messages={messages} />
			<ChatForm
				isLoading={isLoading}
				input={input}
				handleInputChange={handleInputChange}
				onSubmit={onSubmit}
			/>
		</div>
	);
};

export default ChatClient;
