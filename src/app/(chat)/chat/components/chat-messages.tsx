'use client';

import React from 'react';
import ChatMessage, { ChatMessageProps } from './chat-message';
import { ElementRef, useEffect, useRef, useState } from 'react';

interface ChatMessagesProps {
	messages: ChatMessageProps[];
	isLoading?: boolean;
}

const ChatMessages = ({ messages = [], isLoading }: ChatMessagesProps) => {
	const scrollRef = useRef<ElementRef<'div'>>(null);

	const [fakeLoading, setFakeLoading] = useState(
		messages.length === 0 ? true : false
	);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setFakeLoading(false);
		}, 1000);

		return () => {
			clearTimeout(timeout);
		};
	}, []);

	useEffect(() => {
		scrollRef?.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length]);

	return (
		<div className='flex-1 overflow-y-auto pr-4'>
			<ChatMessage
				isLoading={fakeLoading}
				role='assistant'
				content={`Hello I am doctor GPT here to assist you with your medical needs. Remember I'm just an AI tool and not a replacement for a doctor`}
			/>
			{messages.map((message) => (
				<ChatMessage
					key={message.content}
					role={message.role}
					content={message.content}
				/>
			))}
			{isLoading && <ChatMessage role='assistant' isLoading />}
			<div ref={scrollRef} />
		</div>
	);
};

export default React.memo(ChatMessages);
