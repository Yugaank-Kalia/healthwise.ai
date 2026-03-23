'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
	ArrowUp,
	ExternalLink,
	X,
	ArrowDown,
	Loader2,
	Copy,
	Check,
	ThumbsUp,
	ThumbsDown,
	FileDown,
} from 'lucide-react';
import { exportToPDF, type ExportMessage } from '@/lib/export-pdf';
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
import Link from 'next/link';
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

// ─── Types ───────────────────────────────────────────────────────────────────

type Source = {
	pmid: string;
	title: string;
	authors: string | null;
	year: number | null;
	pubmedUrl: string;
};

type MessageStatus = 'pending' | 'indexing' | 'streaming' | 'done' | 'error';

type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	sources?: Source[] | null;
	status?: MessageStatus;
	feedback?: 'up' | 'down' | null;
};

interface Props {
	conversationId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLACEHOLDERS = [
	'What are the mechanisms of mRNA vaccine immunity?',
	'Latest findings on CRISPR off-target effects?',
	'How do checkpoint inhibitors work in cancer?',
	"What biomarkers predict Alzheimer's progression?",
	'Mechanisms of antibiotic resistance in MRSA?',
];

const SUGGESTIONS = [
	'CRISPR gene therapy safety',
	'CAR-T cell therapy mechanisms',
	'mRNA vaccine immune response',
	"Alzheimer's biomarkers",
	'Antibiotic resistance mechanisms',
	'Gut-brain axis in depression',
];

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatAuthor(source: Source) {
	if (!source.authors && !source.year) return null;
	if (!source.authors) return source.year;
	const first = source.authors.split(',')[0];
	const suffix = source.authors.includes(',') ? ' et al.' : '';
	return `${first}${suffix}${source.year ? ` · ${source.year}` : ''}`;
}

// ─── Inline source badge with hover card ─────────────────────────────────────

function SourceBadgeInline({
	pmidStr,
	sources,
}: {
	pmidStr: string;
	sources?: Source[] | null;
}) {
	const idx = sources?.findIndex((s) => s.pmid === pmidStr) ?? -1;
	const source = idx >= 0 ? sources?.[idx] : null;

	return (
		<HoverCard>
			<HoverCardTrigger
				href={`https://pubmed.ncbi.nlm.nih.gov/${pmidStr}/`}
				target='_blank'
				rel='noopener noreferrer'
				delay={200}
				closeDelay={100}
				className='inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-white/15 text-[9px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 transition-colors align-middle mx-0.5'
			>
				{idx >= 0 ? idx + 1 : pmidStr}
			</HoverCardTrigger>
			{source && (
				<HoverCardContent
					side='top'
					align='start'
					className='w-72 p-3 space-y-1.5'
				>
					<p className='text-[10px] font-medium text-slate-400 dark:text-slate-500'>
						pubmed.ncbi.nlm.nih.gov
					</p>
					<p className='text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug line-clamp-3'>
						{source.title}
					</p>
					{formatAuthor(source) && (
						<p className='text-[10px] text-slate-400 dark:text-slate-500 truncate'>
							{formatAuthor(source)}
						</p>
					)}
					<a
						href={source.pubmedUrl}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5'
					>
						Open in PubMed <ExternalLink className='h-2.5 w-2.5' />
					</a>
				</HoverCardContent>
			)}
		</HoverCard>
	);
}

// ─── Markdown-like inline renderer ───────────────────────────────────────────

function renderInline(text: string, sources?: Source[] | null) {
	const parts = text.split(
		/(\*\*[^*]+\*\*|\*[^*]+\*|[\[({](?:PMID:\s*\d+(?:,\s*)?)+[\])}]|PMID:\s*\d+)/g,
	);

	return parts.map((part, i) => {
		// Multi-PMID group
		const multiPmid = part.match(
			/^[\[({]((?:PMID:\s*\d+(?:,\s*)?)+)[\])}]$/,
		);
		if (multiPmid) {
			const pmids = [...multiPmid[1].matchAll(/PMID:\s*(\d+)/g)].map(
				(m) => m[1],
			);
			return (
				<span key={i}>
					{pmids.map((p, j) => (
						<SourceBadgeInline
							key={`${i}-${j}`}
							pmidStr={p}
							sources={sources}
						/>
					))}
				</span>
			);
		}

		// Single PMID (with or without brackets)
		const pmid = part.match(/[\[({]?PMID:\s*(\d+)[\])}]?/);
		if (pmid)
			return (
				<SourceBadgeInline
					key={i}
					pmidStr={pmid[1]}
					sources={sources}
				/>
			);

		// Bold or italic → rendered as semibold
		const boldOrItalic = part.match(/^\*{1,2}([^*]+)\*{1,2}$/);
		if (boldOrItalic)
			return (
				<strong key={i} className='font-semibold'>
					{boldOrItalic[1]}
				</strong>
			);

		return part;
	});
}

// ─── Content renderer (line-by-line) ─────────────────────────────────────────

function renderContent(text: string, sources?: Source[] | null) {
	return text
		.split('\n')
		.filter(
			(line) =>
				!line.trim().startsWith('→') &&
				line.trim() !== '**Related Research Directions**',
		)
		.map((line, i) => {
			const heading = line.match(/^\*{1,2}([^*]+)\*{1,2}$/);
			if (heading)
				return (
					<p
						key={i}
						className='font-semibold text-sm mt-3 mb-0.5 first:mt-0'
					>
						{heading[1]}
					</p>
				);
			if (!line.trim()) return <br key={i} />;
			return <p key={i}>{renderInline(line, sources)}</p>;
		});
}

function extractFollowUps(text: string): string[] {
	return text
		.split('\n')
		.filter((line) => line.trim().startsWith('→'))
		.map((line) => line.replace(/^→\s*/, '').trim());
}

// ─── Source count badge ──────────────────────────────────────────────────────

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
						className='w-4 h-4 rounded-full bg-slate-200 dark:bg-white/15 border border-white dark:border-white/10 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300'
					>
						P
					</span>
				))}
			</span>{' '}
			<span className='group-hover:underline'>
				{sources.length} source{sources.length !== 1 ? 's' : ''}
			</span>
		</button>
	);
}

// ─── Shimmer loading skeleton ─────────────────────────────────────────────────

type SlidePhase = 'idle' | 'exit' | 'pre-enter' | 'enter';

function ShimmerLoading({ indexing }: { indexing: boolean }) {
	const toLabel = (i: boolean) =>
		i
			? 'Fetching PubMed papers - first run may take a moment'
			: 'Thinking…';

	const [label, setLabel] = useState(toLabel(indexing));
	const [phase, setPhase] = useState<SlidePhase>('idle');

	useEffect(() => {
		const next = toLabel(indexing);
		if (next === label) return;
		setPhase('exit');
		const t = setTimeout(() => {
			setLabel(next);
			setPhase('pre-enter');
			requestAnimationFrame(() =>
				requestAnimationFrame(() => setPhase('enter')),
			);
		}, 200);
		return () => clearTimeout(t);
	}, [indexing]);

	const wrapperStyle: React.CSSProperties = {
		opacity: phase === 'exit' || phase === 'pre-enter' ? 0 : 1,
		transform:
			phase === 'exit'
				? 'translateY(-6px)'
				: phase === 'pre-enter'
					? 'translateY(6px)'
					: 'translateY(0)',
		transition:
			phase === 'pre-enter'
				? 'none'
				: 'opacity 0.2s ease, transform 0.2s ease',
	};

	return (
		<div style={wrapperStyle}>
			<p
				className='text-sm'
				style={{
					background:
						'linear-gradient(90deg, #94a3b8 25%, #e2e8f0 50%, #94a3b8 75%)',
					backgroundSize: '200% auto',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent',
					backgroundClip: 'text',
					animation: 'shimmer 1.8s linear infinite',
				}}
			>
				{label}
			</p>
		</div>
	);
}

// ─── Typewriter placeholder hook ─────────────────────────────────────────────

function useTypewriter(active: boolean, inputHasValue: boolean) {
	const [index, setIndex] = useState(0);
	const [text, setText] = useState('');
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!active || inputHasValue) return;

		const full = PLACEHOLDERS[index];

		if (!deleting) {
			if (text.length < full.length) {
				const t = setTimeout(
					() => setText(full.slice(0, text.length + 1)),
					38,
				);
				return () => clearTimeout(t);
			}
			const t = setTimeout(() => setDeleting(true), 2200);
			return () => clearTimeout(t);
		}

		if (text.length > 0) {
			const t = setTimeout(() => setText(text.slice(0, -1)), 18);
			return () => clearTimeout(t);
		}

		setDeleting(false);
		setIndex((i) => (i + 1) % PLACEHOLDERS.length);
	}, [text, deleting, index, active, inputHasValue]);

	return text;
}

// ─── Keyboard hint ───────────────────────────────────────────────────────────

function KeyboardHint() {
	return (
		<div className='hidden sm:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500'>
			<KbdGroup>
				<Kbd>Enter</Kbd>
			</KbdGroup>
			<span>to send</span>
			<KbdGroup>
				<Kbd>Shift</Kbd>+<Kbd>↵</Kbd>
			</KbdGroup>
			<span>new line</span>
		</div>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ResearchChatView({ conversationId }: Props) {
	const router = useRouter();
	const [localConvoId, setLocalConvoId] = useState(conversationId);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [fetchingMessages, setFetchingMessages] = useState(!!conversationId);
	const [drawerSources, setDrawerSources] = useState<Source[] | null>(null);
	const [drawerContext, setDrawerContext] = useState('');
	const [showScrollBtn, setShowScrollBtn] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const bottomRef = useRef<HTMLDivElement>(null);
	const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
		new Map(),
	);
	const initialScrollDone = useRef(false);

	const isEmpty = messages.length === 0;
	const showCenteredInput = isEmpty && !conversationId;
	const phText = useTypewriter(showCenteredInput, !!input);

	const sendDisabled =
		!input.trim() ||
		loading ||
		messages.some((m) => m.role === 'assistant' && m.status === 'pending');

	// ─── Helpers ───────────────────────────────────────────────────────────

	const scrollToBottom = useCallback(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	const updateMessage = useCallback(
		(id: string, patch: Partial<ChatMessage>) => {
			setMessages((prev) =>
				prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
			);
		},
		[],
	);

	const handleFeedback = useCallback(
		async (msgId: string, value: 'up' | 'down') => {
			const currentMsg = messages.find((m) => m.id === msgId);
			const currentFeedback = currentMsg?.feedback;
			const isRemoving = currentFeedback === value;

			setMessages((prev) =>
				prev.map((m) =>
					m.id === msgId
						? { ...m, feedback: isRemoving ? null : value }
						: m,
				),
			);

			try {
				if (isRemoving) {
					await fetch(`/api/messages/${msgId}/feedback`, {
						method: 'DELETE',
					});
				} else {
					await fetch(`/api/messages/${msgId}/feedback`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ value }),
					});
				}
			} catch {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === msgId
							? { ...m, feedback: currentFeedback }
							: m,
					),
				);
			}
		},
		[messages],
	);

	// ─── Polling (recovery on reload) ──────────────────────────────────────

	const startPolling = useCallback(
		(messageId: string, convoId: string) => {
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
					updateMessage(messageId, {
						content: msg.content,
						sources: msg.sources,
						status: msg.status,
					});
					setLoading(false);
				}
			}, 2000);
			pollTimers.current.set(messageId, timer);
		},
		[updateMessage],
	);

	useEffect(() => {
		return () => pollTimers.current.forEach((t) => clearInterval(t));
	}, []);

	// ─── Reset on active conversation deletion ─────────────────────────────

	useEffect(() => {
		const onDeleted = (e: Event) => {
			const { id } = (e as CustomEvent<{ id: string }>).detail;
			if (id !== localConvoId) return;
			setMessages([]);
			setLocalConvoId(undefined);
			setFetchingMessages(false);
			router.replace('/research');
		};
		window.addEventListener('conversation-deleted', onDeleted);
		return () =>
			window.removeEventListener('conversation-deleted', onDeleted);
	}, [localConvoId, router]);

	// ─── Load messages ─────────────────────────────────────────────────────

	useEffect(() => {
		if (!conversationId) {
			setMessages([]);
			setLocalConvoId(undefined);
			setFetchingMessages(false);
			return;
		}
		setFetchingMessages(true);
		setLocalConvoId(conversationId);

		fetch(`/api/conversations/${conversationId}/messages`)
			.then((r) => {
				if (r.status === 404) {
					router.replace('/not-found');
					return null;
				}
				return r.json();
			})
			.then((rows: Record<string, unknown>[] | null) => {
				if (!rows || !Array.isArray(rows)) return;
				const loaded = rows.map((m) => {
					const raw = (m.status as MessageStatus) ?? 'done';
					const status =
						raw === 'streaming' && m.content ? 'done' : raw;
					return {
						id: m.id as string,
						role: m.role as 'user' | 'assistant',
						content: m.content as string,
						sources: m.sources as Source[] | null,
						status,
						feedback: (m.feedback as 'up' | 'down' | null) ?? null,
					};
				});
				setMessages(loaded);

				const inProgress = loaded.filter(
					(m) => m.status === 'pending' || m.status === 'indexing',
				);
				if (inProgress.length > 0) {
					setLoading(true);
					inProgress.forEach((m) =>
						startPolling(m.id, conversationId),
					);
				}
			})
			.finally(() => setFetchingMessages(false));
	}, [conversationId, startPolling]);

	// ─── Scroll observers ──────────────────────────────────────────────────

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

	useEffect(() => {
		if (!messages.length) return;
		bottomRef.current?.scrollIntoView({
			behavior: initialScrollDone.current ? 'smooth' : 'instant',
		});
		initialScrollDone.current = true;
	}, [messages]);

	// ─── Sources drawer ────────────────────────────────────────────────────

	function openSources(msg: ChatMessage) {
		if (!msg.sources?.length) return;
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

	// ─── SSE stream consumer ───────────────────────────────────────────────

	async function consumeSSE(
		assistantId: string,
		query: string,
		convoId: string,
	) {
		const update = (patch: Partial<ChatMessage>) =>
			updateMessage(assistantId, patch);

		try {
			const res = await fetch('/api/research', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query,
					conversationId: convoId,
					messageId: assistantId,
					stream: true,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				const msg =
					body.error ?? 'Something went wrong. Please try again.';
				update({ status: 'error', content: msg });
				setLoading(false);
				return;
			}

			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let buf = '';

			outer: while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				const lines = buf.split('\n');
				buf = lines.pop() ?? '';
				let eventName = '';
				for (const line of lines) {
					if (line.startsWith('event:')) {
						eventName = line.slice(6).trim();
						continue;
					}
					if (!line.startsWith('data:')) continue;
					const payload = JSON.parse(line.slice(5).trim());

					switch (eventName) {
						case 'progress':
							update({ status: 'indexing' });
							break;
						case 'meta':
							update({ sources: payload.sources });
							break;
						case 'token':
							setMessages((prev) =>
								prev.map((m) =>
									m.id === assistantId
										? {
												...m,
												status: 'streaming',
												content:
													m.content + payload.content,
											}
										: m,
								),
							);
							setTimeout(scrollToBottom, 0);
							break;
						case 'done':
							update({ status: 'done' });
							setLoading(false);
							break outer;
						case 'error':
							update({
								status: 'error',
								content:
									payload.error ?? 'Something went wrong.',
							});
							setLoading(false);
							break outer;
					}
				}
			}
			reader.releaseLock();
		} catch {
			update({
				status: 'error',
				content: 'Something went wrong. Please try again.',
			});
			setLoading(false);
		}
	}

	// ─── Send message ──────────────────────────────────────────────────────

	async function handleSend() {
		const text = input.trim();
		if (!text || loading) return;

		const tempUserId = `temp-user-${Date.now()}`;
		const tempAssistantId = `pending-${Date.now()}`;

		setMessages((prev) => [
			...prev,
			{ id: tempUserId, role: 'user', content: text, status: 'done' },
			{
				id: tempAssistantId,
				role: 'assistant',
				content: '',
				status: 'pending',
			},
		]);
		setInput('');
		setLoading(true);
		setTimeout(scrollToBottom, 0);

		try {
			// Get or create conversation
			let convoId = localConvoId;
			const title = text.slice(0, 80);

			if (!convoId) {
				const res = await fetch('/api/conversations', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, type: 'research' }),
				});
				const convo = await res.json();
				convoId = convo.id as string;
				setLocalConvoId(convoId);
				window.history.pushState(null, '', `/research/${convoId}`);
				window.dispatchEvent(new CustomEvent('sidebar-refresh'));
			} else if (isEmpty) {
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

			// Save user message (fire-and-forget)
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

			// Create pending assistant row, get DB id
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
			const { id: dbAssistantId } = await pendingRes.json();

			// Swap temp id with real DB id
			setMessages((prev) =>
				prev.map((m) =>
					m.id === tempAssistantId ? { ...m, id: dbAssistantId } : m,
				),
			);

			// Stream the response
			await consumeSSE(dbAssistantId, text, convoId);
		} catch {
			updateMessage(tempAssistantId, {
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

	async function handleExport() {
		const exportMessages: ExportMessage[] = messages
			.filter((m) => m.status === 'done')
			.map((m) => ({
				role: m.role,
				content: m.content,
				sources: m.sources,
			}));
		await exportToPDF(exportMessages, 'research');
	}

	// ─── Input boxes ─────────────────────────────────────────────────────

	const inputBox = (
		<div className='relative border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-white/5 flex items-center gap-2 px-4 pt-3 pb-8'>
			<Textarea
				rows={1}
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder='Ask about biomedical research…'
				className='flex-1 resize-none border-none shadow-none bg-transparent dark:bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:ring-0 max-h-40 p-0'
			/>
			<Button
				size='icon'
				onClick={handleSend}
				disabled={sendDisabled}
				className='shrink-0 rounded-full bg-blue-900 hover:bg-blue-800 text-white'
			>
				<ArrowUp className='h-4 w-4' />
			</Button>
			<div className='absolute bottom-2.5 left-4 flex items-center gap-2'>
				<KeyboardHint />
				{!isEmpty && (
					<button
						onClick={handleExport}
						title='Export to PDF'
						className='cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors'
					>
						<FileDown className='h-3.5 w-3.5' />
					</button>
				)}
			</div>
		</div>
	);

	const centeredInputBox = (
		<div className='border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-white/5 flex items-end gap-3 px-5 py-4'>
			<div className='relative flex-1'>
				{!input && (
					<span className='pointer-events-none absolute top-0 left-0 text-sm text-slate-400 dark:text-slate-500'>
						{phText}
					</span>
				)}
				<Textarea
					rows={3}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder=''
					className='w-full resize-none border-none shadow-none bg-transparent dark:bg-transparent text-sm text-slate-900 dark:text-white focus-visible:ring-0 p-0'
				/>
			</div>
			<div className='flex items-center justify-center gap-2 shrink-0'>
				<KeyboardHint />
				<Button
					size='icon'
					onClick={handleSend}
					disabled={sendDisabled}
					className='shrink-0 rounded-full bg-blue-900 hover:bg-blue-800 text-white h-8 w-8'
				>
					<ArrowUp className='h-4 w-4' />
				</Button>
			</div>
		</div>
	);

	// ─── Render ──────────────────────────────────────────────────────────

	if (fetchingMessages) {
		return (
			<div className='flex-1 flex items-center justify-center bg-white dark:bg-[oklch(0.14_0.03_258)]'>
				<Loader2 className='h-6 w-6 animate-spin text-blue-600' />
			</div>
		);
	}

	return (
		<>
			<div className='relative flex-1 flex flex-col min-h-0'>
				{showCenteredInput ? (
					<div className='flex-1 flex flex-col items-center justify-center gap-6 px-4'>
						<div className='text-center'>
							<h2 className='text-3xl font-bold text-slate-900 dark:text-white'>
								What do you want to research?
							</h2>
							<p className='text-sm text-slate-500 dark:text-slate-400 mt-2'>
								Biomedical research backed by PubMed
							</p>
						</div>
						<div className='max-w-2xl w-full'>
							{centeredInputBox}
							<div className='flex flex-wrap justify-center gap-2 mt-4'>
								{SUGGESTIONS.map((s) => (
									<button
										key={s}
										onClick={() => setInput(s)}
										className='cursor-pointer text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white transition-colors'
									>
										{s}
									</button>
								))}
							</div>
						</div>
					</div>
				) : isEmpty ? (
					<div className='flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center'>
						<h2 className='text-2xl font-semibold text-slate-900 dark:text-white'>
							What would you like to research?
						</h2>
						<p className='text-sm text-slate-500 dark:text-slate-400 max-w-xs'>
							Ask me anything about biomedical research - backed
							by PubMed.
						</p>
					</div>
				) : (
					<ScrollArea className='flex-1 min-h-0'>
						<div className='max-w-3xl mx-auto px-4 py-6 space-y-4'>
							{messages.map((msg) => {
								const isAssistant = msg.role === 'assistant';
								const isPending =
									msg.status === 'pending' ||
									msg.status === 'indexing';
								const isDone = msg.status === 'done';
								const isInteractive =
									!isPending && msg.status !== 'streaming';

								if (isAssistant && !msg.content && !isPending)
									return null;

								if (isAssistant && isPending) {
									return (
										<div
											key={msg.id}
											className='flex flex-col items-start'
										>
											<ShimmerLoading
												indexing={
													msg.status === 'indexing'
												}
											/>
										</div>
									);
								}

								return (
									<div
										key={msg.id}
										className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
									>
										<div className='group relative max-w-[80%]'>
											<div
												className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
													msg.role === 'user'
														? 'bg-blue-900 text-white rounded-br-sm'
														: 'bg-slate-100 dark:bg-white/8 text-slate-800 dark:text-slate-200 rounded-bl-sm'
												}`}
											>
												<div className='space-y-0'>
													{renderContent(
														msg.content,
														msg.sources,
													)}
												</div>
												{isAssistant &&
												isDone &&
												msg.sources?.length ? (
													<SourceBadge
														sources={msg.sources}
														onClick={() =>
															openSources(msg)
														}
													/>
												) : null}

												{isAssistant && isDone && (
													<p className='mt-3 text-xs text-slate-900 dark:text-white font-medium'>
														🔬 Healthwise is AI and
														can make mistakes.
														Please proceed with
														caution.
													</p>
												)}
											</div>

											{isInteractive && (
												<>
													<button
														onClick={() => {
															navigator.clipboard.writeText(
																msg.content,
															);
															setCopiedId(msg.id);
															setTimeout(
																() =>
																	setCopiedId(
																		null,
																	),
																2000,
															);
														}}
														className={`cursor-pointer absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ${
															msg.role === 'user'
																? 'right-1'
																: 'left-1'
														}`}
														title='Copy'
													>
														{copiedId === msg.id ? (
															<Check className='h-3.5 w-3.5 text-green-500' />
														) : (
															<Copy className='h-3.5 w-3.5' />
														)}
													</button>
													{isAssistant && (
														<div className='absolute -bottom-5 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
															<button
																onClick={() =>
																	handleFeedback(
																		msg.id,
																		'up',
																	)
																}
																className={`cursor-pointer transition-all active:scale-125 ${
																	msg.feedback ===
																	'up'
																		? 'text-emerald-500 dark:text-emerald-400'
																		: 'text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400'
																}`}
																title='Helpful'
															>
																<ThumbsUp
																	className='h-3.5 w-3.5'
																	fill={
																		msg.feedback ===
																		'up'
																			? 'currentColor'
																			: 'none'
																	}
																/>
															</button>
															<button
																onClick={() =>
																	handleFeedback(
																		msg.id,
																		'down',
																	)
																}
																className={`cursor-pointer transition-all active:scale-125 ${
																	msg.feedback ===
																	'down'
																		? 'text-rose-500 dark:text-rose-400'
																		: 'text-slate-400 hover:text-rose-500 dark:hover:text-rose-400'
																}`}
																title='Not helpful'
															>
																<ThumbsDown
																	className='h-3.5 w-3.5'
																	fill={
																		msg.feedback ===
																		'down'
																			? 'currentColor'
																			: 'none'
																	}
																/>
															</button>
														</div>
													)}
												</>
											)}
										</div>

										{isAssistant &&
											isDone &&
											(() => {
												const followUps =
													extractFollowUps(
														msg.content,
													);
												return followUps.length > 0 ? (
													<div className='flex flex-col gap-2 max-w-[80%] pt-8'>
														<p className='text-xs font-semibold text-slate-500 dark:text-slate-400 px-1'>
															Related Research
															Directions
														</p>
														{followUps.map((q) => (
															<button
																key={q}
																onClick={() =>
																	setInput(q)
																}
																className='rounded-2xl px-4 py-3 text-sm leading-relaxed text-left bg-slate-100 dark:bg-white/8 text-slate-800 dark:text-slate-200 rounded-tl-sm hover:bg-slate-200 dark:hover:bg-white/12 transition-colors'
															>
																{renderInline(
																	q,
																)}
															</button>
														))}
													</div>
												) : null;
											})()}
									</div>
								);
							})}
							<div ref={bottomRef} />
						</div>
					</ScrollArea>
				)}

				{showScrollBtn && (
					<div className='absolute bottom-40 left-1/2 -translate-x-1/2 z-10'>
						<Button
							size='icon'
							onClick={scrollToBottom}
							className='rounded-full shadow-md bg-white dark:bg-white border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/90 h-8 w-8'
						>
							<ArrowDown className='h-4 w-4' />
						</Button>
					</div>
				)}

				{!showCenteredInput && (
					<div className='max-w-3xl w-full mx-auto px-4 pb-6 pt-3'>
						{inputBox}
					</div>
				)}
			</div>

			{/* Sources drawer */}
			<Drawer
				direction='right'
				open={!!drawerSources}
				onOpenChange={(open) => {
					if (!open) setDrawerSources(null);
				}}
			>
				<DrawerContent className='flex flex-col w-95 sm:max-w-95 overflow-hidden'>
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

					<div className='border-t border-slate-100 dark:border-white/8' />
					{drawerContext && (
						<DrawerHeader className='px-5 py-4'>
							<p className='text-sm text-slate-400 dark:text-slate-500 leading-snug'>
								Sources for {drawerContext}
							</p>
						</DrawerHeader>
					)}

					<ScrollArea className='flex-1 min-h-0'>
						<ul className='p-4 space-y-3'>
							{drawerSources?.map((source, i) => (
								<li key={source.pmid}>
									<Link
										href={source.pubmedUrl}
										target='_blank'
										rel='noopener noreferrer'
										className='flex gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group'
									>
										<div className='w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-400 text-xs font-bold'>
											{i + 1}
										</div>
										<div className='flex-1 min-w-0'>
											<p className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5'>
												pubmed.ncbi.nlm.nih.gov
											</p>
											<p className='text-sm text-slate-800 dark:text-slate-200 leading-snug line-clamp-3 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors'>
												{source.title}
											</p>
											{formatAuthor(source) && (
												<p className='mt-1 text-xs text-slate-400 dark:text-slate-500 truncate'>
													{formatAuthor(source)}
												</p>
											)}
										</div>
										<ExternalLink className='h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors mt-0.5' />
									</Link>
								</li>
							))}
						</ul>
					</ScrollArea>
				</DrawerContent>
			</Drawer>
		</>
	);
}
