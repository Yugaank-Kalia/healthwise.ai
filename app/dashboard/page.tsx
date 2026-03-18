'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

import { useState, useEffect } from 'react';

type Message = {
	id: number;
	role: 'user' | 'assistant';
	content: string;
};

const DUMMY_RESPONSES = [
	'Based on NIH research, a balanced diet rich in whole grains, lean proteins, and vegetables is key to long-term health. Would you like personalized recommendations?',
	'Great question! Studies show that eating colorful vegetables like spinach, carrots, and bell peppers provides a wide range of micronutrients essential for your body.',
	'For optimal energy levels, aim for 3 balanced meals a day with healthy snacks in between. Focus on complex carbohydrates, protein, and healthy fats.',
	'Hydration is often overlooked! The NIH recommends around 2.7 liters of water per day for women and 3.7 liters for men, including water from food sources.',
	'Omega-3 fatty acids found in fish like salmon and sardines are linked to reduced inflammation and improved heart health. Try to include them 2–3 times a week.',
];

function randomResponse() {
	return DUMMY_RESPONSES[Math.floor(Math.random() * DUMMY_RESPONSES.length)];
}

export default function DashboardPage() {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: 0,
			role: 'assistant',
			content:
				"Hi! I'm your personal nutrition assistant. Ask me anything about diet, nutrition, or healthy eating.",
		},
	]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);

	async function handleSend() {
		const text = input.trim();
		if (!text || loading) return;

		const userMsg: Message = {
			id: Date.now(),
			role: 'user',
			content: text,
		};
		setMessages((prev) => [...prev, userMsg]);
		setInput('');
		setLoading(true);

		await new Promise((r) => setTimeout(r, 800));

		const assistantMsg: Message = {
			id: Date.now() + 1,
			role: 'assistant',
			content: randomResponse(),
		};
		setMessages((prev) => [...prev, assistantMsg]);
		setLoading(false);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	return (
		<div className='flex-1 min-h-0 bg-white dark:bg-[oklch(0.14_0.03_258)] flex flex-col'>
			<div className='flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pb-6'>
				{/* Messages */}
				<ScrollArea className='flex-1 py-6'>
					<div className='space-y-4'>
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
							>
								<div
									className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
										msg.role === 'user'
											? 'bg-blue-900 text-white rounded-br-sm'
											: 'bg-slate-100 dark:bg-white/8 text-slate-800 dark:text-slate-200 rounded-bl-sm'
									}`}
								>
									{msg.content}
								</div>
							</div>
						))}
						{loading && (
							<div className='flex justify-start'>
								<div className='bg-slate-100 dark:bg-white/8 rounded-2xl rounded-bl-sm px-4 py-3'>
									<span className='flex gap-1 items-center h-4'>
										<span className='w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]' />
										<span className='w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]' />
										<span className='w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]' />
									</span>
								</div>
							</div>
						)}
						<div />
					</div>
				</ScrollArea>

				{/* Input */}
				<div className='border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-white/5 flex items-center gap-2 px-4 py-3'>
					<Textarea
						rows={1}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder='Ask about nutrition, diet, or healthy eating…'
						className='flex-1 resize-none border-none shadow-none bg-transparent dark:bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:ring-0 max-h-40 p-0'
					/>
					<Button
						size='icon'
						onClick={handleSend}
						disabled={!input.trim() || loading}
						className='shrink-0 rounded-full bg-blue-900 hover:bg-blue-800 text-white'
					>
						<Send className='h-4 w-4' />
					</Button>
				</div>
			</div>
		</div>
	);
}
