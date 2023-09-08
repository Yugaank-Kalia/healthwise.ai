'use client';

import { useState } from 'react';
import { StepForward } from 'lucide-react';

export default function ClientSection() {
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [response, setResponse] = useState<String>('');

	const prompt = `Q: ${input} Generate a response with less than 200 characters as a doctor.`;

	const generateResponse = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		setResponse('');
		setLoading(true);

		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt,
			}),
		});

		if (!response.ok) {
			throw new Error(response.statusText);
		}

		const data = response.body;
		if (!data) {
			return;
		}

		const reader = data.getReader();
		const decoder = new TextDecoder();
		let done = false;

		while (!done) {
			setInput('');
			const { value, done: doneReading } = await reader.read();
			done = doneReading;
			const chunkValue = decoder.decode(value);
			setResponse((prev) => prev + chunkValue);
		}
		setLoading(false);
	};

	return (
		<div className='absolute w-full h-full max-w-xl gap-4 flex flex-col'>
			{response && (
				<div className='mt-8 rounded-xl border bg-white p-4 shadow-md transition hover:bg-gray-100'>
					{response}
				</div>
			)}
			<div className='relative flex gap-2 w-full top-[600px]'>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					maxLength={200}
					className='focus:ring-neu w-full rounded-md border border-neutral-400
         p-4 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900'
					placeholder={'Q: My head hurts doctor'}
				/>
				{!loading ? (
					<button
						className='rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-black/80'
						onClick={(e) => generateResponse(e)}
					>
						<StepForward />
					</button>
				) : (
					<button
						disabled
						className='rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white'
					>
						<div className='animate-pulse font-bold tracking-widest'>
							...
						</div>
					</button>
				)}
			</div>
		</div>
	);
}
