'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, ExternalLink, X, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerClose,
} from '@/components/ui/drawer';

type Source = {
	pmid: string;
	title: string;
	authors: string | null;
	year: number | null;
	pubmedUrl: string;
};

type MessageStatus = 'pending' | 'done' | 'error';

type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	sources?: Source[] | null;
	status?: MessageStatus;
};

interface Props {
	conversationId?: string;
}

function renderInline(text: string) {
	// Handle **bold** and [PMID: XXXXXXXX] inline
	const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[PMID:\s*\d+\])/g);
	return parts.map((part, i) => {
		const pmid = part.match(/\[PMID:\s*(\d+)\]/);
		if (pmid) {
			return (
				<a
					key={i}
					href={`https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/`}
					target='_blank'
					rel='noopener noreferrer'
					className='text-blue-400 hover:text-blue-300 hover:underline'
				>
					{part}
				</a>
			);
		}
		const bold = part.match(/^\*\*([^*]+)\*\*$/);
		if (bold) {
			return (
				<strong key={i} className='font-semibold'>
					{bold[1]}
				</strong>
			);
		}
		const italic = part.match(/^\*([^*]+)\*$/);
		if (italic) {
			return (
				<strong key={i} className='font-semibold'>
					{italic[1]}
				</strong>
			);
		}
		return part;
	});
}

function renderContent(text: string) {
	return text.split('\n').map((line, i) => {
		// Whole line is a heading: **Heading Text** or *Heading Text*
		const heading = line.match(/^(?:\*\*([^*]+)\*\*|\*([^*]+)\*)$/);
		if (heading) {
			return (
				<p
					key={i}
					className='font-semibold text-sm mt-3 mb-0.5 first:mt-0'
				>
					{heading[1] ?? heading[2]}
				</p>
			);
		}
		// Empty line → spacer
		if (line.trim() === '') {
			return <br key={i} />;
		}
		return <p key={i}>{renderInline(line)}</p>;
	});
}

function SourceBadge({
	sources,
	onClick,
}: {
	sources: Source[];
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className='mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group cursor-pointer'
		>
			<span className='flex items-center -space-x-1'>
				{sources.slice(0, 3).map((s) => (
					<span
						key={s.pmid}
						className='w-4 h-4 rounded-full bg-slate-200 dark:bg-white/15 border border-white dark:border-white/10 flex items-center justify-center text-[8px] font-semibold text-slate-600 dark:text-slate-300'
					>
						N
					</span>
				))}
			</span>
			<span className='group-hover:underline'>
				{sources.length} source{sources.length !== 1 ? 's' : ''}
			</span>
		</button>
	);
}

export default function ChatView({ conversationId }: Props) {
	const [localConvoId, setLocalConvoId] = useState<string | undefined>(
		conversationId,
	);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [drawerSources, setDrawerSources] = useState<Source[] | null>(null);
	const [drawerContext, setDrawerContext] = useState('');
	const [showScrollBtn, setShowScrollBtn] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
		new Map(),
	);

	function startPolling(messageId: string, convoId: string) {
		if (pollTimers.current.has(messageId)) return;
		const timer = setInterval(async () => {
			const res = await fetch(
				`/api/conversations/${convoId}/messages/${messageId}`,
			);
			if (!res.ok) return;
			const msg = await res.json();
			if (msg.status === 'done' || msg.status === 'error') {
				clearInterval(timer);
				pollTimers.current.delete(messageId);
				setMessages((prev) =>
					prev.map((m) =>
						m.id === messageId
							? {
									...m,
									content: msg.content,
									sources: msg.sources,
									status: msg.status,
								}
							: m,
					),
				);
				setLoading(false);
			}
		}, 2000);
		pollTimers.current.set(messageId, timer);
	}

	useEffect(() => {
		return () => pollTimers.current.forEach((t) => clearInterval(t));
	}, []);

	// Load messages when conversationId is provided
	useEffect(() => {
		if (!conversationId) {
			setMessages([]);
			setLocalConvoId(undefined);
			return;
		}
		setLocalConvoId(conversationId);
		fetch(`/api/conversations/${conversationId}/messages`)
			.then((r) => r.json())
			.then((rows: Record<string, unknown>[]) => {
				if (!Array.isArray(rows)) return;

				setMessages(
					rows.map((m) => ({
						id: m.id as string,
						role: m.role as 'user' | 'assistant',
						content: m.content as string,
						sources: m.sources as Source[] | null,
						status: (m.status as MessageStatus) ?? 'done',
					})),
				);

				// Resume polling for any pending messages (e.g. after page reload)
				rows.filter((m) => m.status === 'pending').forEach((m) =>
					startPolling(m.id as string, conversationId),
				);
			});
	}, [conversationId]);

	// Show scroll-to-bottom button when bottomRef leaves viewport
	useEffect(() => {
		const el = bottomRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => setShowScrollBtn(!entry.isIntersecting),
			{ threshold: 0 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [messages]);

	function scrollToBottom() {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}

	function openSources(msg: ChatMessage) {
		if (!msg.sources?.length) return;
		// Find the user message that preceded this assistant message
		const idx = messages.indexOf(msg);
		const userMsg = messages
			.slice(0, idx)
			.findLast((m) => m.role === 'user');
		setDrawerContext(
			userMsg
				? `"${userMsg.content.slice(0, 80)}${userMsg.content.length > 80 ? '…' : ''}"`
				: '',
		);
		setDrawerSources(msg.sources);
	}

	async function handleSend() {
		const text = input.trim();
		if (!text || loading) return;

		setMessages((prev) => [
			...prev,
			{
				id: `temp-user-${Date.now()}`,
				role: 'user',
				content: text,
				status: 'done',
			},
		]);
		setInput('');
		setLoading(true);
		setTimeout(scrollToBottom, 0);

		// Temp ID for the pending assistant bubble
		const tempAssistantId = `pending-${Date.now()}`;
		let dbAssistantId = tempAssistantId;
		setMessages((prev) => [
			...prev,
			{
				id: tempAssistantId,
				role: 'assistant',
				content: '',
				status: 'pending',
			},
		]);

		const patchAssistant = (
			id: string,
			convoId: string,
			patch: Partial<ChatMessage>,
		) => {
			setMessages((prev) =>
				prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
			);
			fetch(`/api/conversations/${convoId}/messages/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch),
			});
		};

		try {
			// Get or create conversation
			let convoId = localConvoId;
			const title = text.slice(0, 80);
			if (!convoId) {
				const res = await fetch('/api/conversations', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title }),
				});
				const convo = await res.json();
				convoId = convo.id as string;
				setLocalConvoId(convoId);
				window.history.pushState(null, '', `/dashboard/${convoId}`);
				window.dispatchEvent(new CustomEvent('sidebar-refresh'));
			} else if (messages.length === 0) {
				fetch(`/api/conversations/${convoId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title }),
				});
				window.dispatchEvent(
					new CustomEvent('conversation-renamed', {
						detail: { id: convoId, title },
					}),
				);
			}

			const userOrder = messages.length;

			// Save user message
			fetch(`/api/conversations/${convoId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role: 'user',
					content: text,
					status: 'done',
					order: userOrder,
				}),
			});

			// Insert pending assistant row in DB, get back its real ID
			const pendingRes = await fetch(
				`/api/conversations/${convoId}/messages`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						role: 'assistant',
						content: '',
						status: 'pending',
						order: userOrder + 1,
					}),
				},
			);
			const pendingRow = await pendingRes.json();
			dbAssistantId = pendingRow.id as string;

			// Replace tempId with real DB id in state
			setMessages((prev) =>
				prev.map((m) =>
					m.id === tempAssistantId ? { ...m, id: dbAssistantId } : m,
				),
			);

			// Kick off async LLM processing - returns 202 immediately
			await fetch('/api/ask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: text,
					conversationId: convoId,
					messageId: dbAssistantId,
				}),
			});

			// Poll DB every 2s until done or error
			startPolling(dbAssistantId, convoId);
		} catch {
			patchAssistant(dbAssistantId, localConvoId!, {
				content: 'Something went wrong. Please try again.',
				status: 'error',
			});
			setLoading(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	const isEmpty = messages.length === 0;

	return (
		<>
			<div className='relative flex-1 flex flex-col min-h-0 bg-white dark:bg-[oklch(0.14_0.03_258)]'>
				{isEmpty ? (
					<div className='flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center'>
						<h2 className='text-2xl font-semibold text-slate-900 dark:text-white'>
							What would you like to know?
						</h2>
						<p className='text-sm text-slate-500 dark:text-slate-400 max-w-xs'>
							Ask me anything about nutrition, diet, or healthy
							eating - backed by NIH research.
						</p>
					</div>
				) : (
					<ScrollArea className='flex-1 min-h-0'>
						<div className='max-w-3xl mx-auto px-4 py-6 space-y-4'>
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
										{/* Content or loading dots */}
										{msg.role === 'assistant' &&
										msg.status === 'pending' ? (
											<span className='flex gap-1 items-center h-4'>
												<span className='w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]' />
												<span className='w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]' />
												<span className='w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]' />
											</span>
										) : (
											<div className='space-y-0'>
												{renderContent(msg.content)}
											</div>
										)}
										{msg.role === 'assistant' &&
											msg.sources &&
											msg.sources.length > 0 && (
												<SourceBadge
													sources={msg.sources}
													onClick={() =>
														openSources(msg)
													}
												/>
											)}
									</div>
								</div>
							))}
							<div ref={bottomRef} />
						</div>
					</ScrollArea>
				)}

				{/* Scroll to bottom */}
				{showScrollBtn && (
					<div className='absolute bottom-36 left-1/2 -translate-x-1/2 z-10'>
						<Button
							size='icon'
							onClick={scrollToBottom}
							className='rounded-full shadow-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/15 h-8 w-8'
						>
							<ArrowDown className='h-4 w-4' />
						</Button>
					</div>
				)}

				{/* Input */}
				<div className='max-w-3xl w-full mx-auto px-4 pb-6 pt-3'>
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
					<p className='text-center text-xs text-slate-400 dark:text-slate-600 mt-2'>
						Press Enter to send · Shift+Enter for new line
					</p>
				</div>
			</div>

			{/* Sources drawer */}
			<Drawer
				direction='right'
				open={!!drawerSources}
				onOpenChange={(open) => {
					if (!open) setDrawerSources(null);
				}}
			>
				<DrawerContent className='flex flex-col w-95 sm:max-w-95'>
					{/* Top bar: title left, close right */}
					<div className='flex items-center justify-between px-5 py-4'>
						<DrawerTitle className='text-base font-semibold text-slate-900 dark:text-white'>
							{drawerSources?.length} source
							{drawerSources?.length !== 1 ? 's' : ''}
						</DrawerTitle>
						<DrawerClose asChild>
							<Button
								variant='ghost'
								size='icon'
								className='h-7 w-7 rounded-lg shrink-0 text-slate-500 dark:text-slate-400'
							>
								<X className='h-4 w-4' />
							</Button>
						</DrawerClose>
					</div>

					{/* Divider + context */}
					<div className='border-t border-slate-100 dark:border-white/8' />
					{drawerContext && (
						<DrawerHeader className='px-5 py-4'>
							<p className='text-sm text-slate-400 dark:text-slate-500 leading-snug'>
								Sources for {drawerContext}
							</p>
						</DrawerHeader>
					)}

					<ScrollArea className='flex-1'>
						<ul className='p-4 space-y-3'>
							{drawerSources?.map((source, i) => (
								<li key={source.pmid}>
									<a
										href={source.pubmedUrl}
										target='_blank'
										rel='noopener noreferrer'
										className='flex gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group'
									>
										{/* Icon */}
										<div className='w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-400 text-xs font-bold'>
											{i + 1}
										</div>
										{/* Content */}
										<div className='flex-1 min-w-0'>
											<p className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5'>
												pubmed.ncbi.nlm.nih.gov
											</p>
											<p className='text-sm text-slate-800 dark:text-slate-200 leading-snug line-clamp-3 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors'>
												{source.title}
											</p>
											{(source.authors ||
												source.year) && (
												<p className='mt-1 text-xs text-slate-400 dark:text-slate-500 truncate'>
													{source.authors
														? `${source.authors.split(',')[0]}${source.authors.includes(',') ? ' et al.' : ''}${source.year ? ` · ${source.year}` : ''}`
														: source.year}
												</p>
											)}
										</div>
										<ExternalLink className='h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors mt-0.5' />
									</a>
								</li>
							))}
						</ul>
					</ScrollArea>
				</DrawerContent>
			</Drawer>
		</>
	);
}
