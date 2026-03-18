'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
	MessageSquarePlus,
	MoreHorizontal,
	Pencil,
	Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Conversation = {
	id: string;
	title: string;
	updatedAt: string;
};

export default function ChatSidebar() {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState('');
	const renameRef = useRef<HTMLInputElement>(null);
	const pathname = usePathname();
	const router = useRouter();

	const activeId = pathname.startsWith('/dashboard/')
		? pathname.split('/dashboard/')[1]
		: null;

	const fetchConversations = useCallback(async () => {
		const res = await fetch('/api/conversations');
		if (res.ok) setConversations(await res.json());
	}, []);

	useEffect(() => {
		fetchConversations();
	}, [pathname, fetchConversations]);

	useEffect(() => {
		const handler = () => fetchConversations();
		window.addEventListener('sidebar-refresh', handler);
		return () => window.removeEventListener('sidebar-refresh', handler);
	}, [fetchConversations]);

	useEffect(() => {
		const handler = (e: Event) => {
			const { id, title } = (
				e as CustomEvent<{ id: string; title: string }>
			).detail;
			setConversations((prev) =>
				prev.map((c) => (c.id === id ? { ...c, title } : c)),
			);
		};
		window.addEventListener('conversation-renamed', handler);
		return () =>
			window.removeEventListener('conversation-renamed', handler);
	}, []);

	useEffect(() => {
		if (renamingId) renameRef.current?.focus();
	}, [renamingId]);

	async function handleNewChat() {
		const res = await fetch('/api/conversations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Chat' }),
		});
		const convo = await res.json();
		router.push(`/dashboard/${convo.id}`);
	}

	async function handleDelete(id: string) {
		await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
		if (activeId === id) router.push('/dashboard');
		setConversations((prev) => prev.filter((c) => c.id !== id));
	}

	function startRename(convo: Conversation) {
		setRenamingId(convo.id);
		setRenameValue(convo.title);
	}

	async function commitRename(id: string) {
		const title = renameValue.trim();
		if (!title) {
			setRenamingId(null);
			return;
		}
		await fetch(`/api/conversations/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title }),
		});
		setConversations((prev) =>
			prev.map((c) => (c.id === id ? { ...c, title } : c)),
		);
		setRenamingId(null);
	}

	return (
		<aside className='w-64 shrink-0 flex flex-col border-r border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 overflow-hidden'>
			<div className='p-3'>
				<Button
					onClick={handleNewChat}
					variant='ghost'
					className='w-full justify-start gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/8 rounded-lg'
				>
					<MessageSquarePlus className='h-4 w-4 shrink-0' />
					<span className='text-sm font-medium'>New Chat</span>
				</Button>
			</div>

			<div className='px-3 pb-1'>
				<p className='text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2'>
					Conversations
				</p>
			</div>

			<nav className='flex-1 overflow-y-auto px-3 pb-3 space-y-0.5'>
				{conversations.length === 0 && (
					<p className='text-xs text-slate-400 dark:text-slate-500 px-2 py-3'>
						No conversations yet
					</p>
				)}
				{conversations.map((convo) => (
					<div
						key={convo.id}
						className={cn(
							'group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors',
							activeId === convo.id
								? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white'
								: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white',
						)}
					>
						{renamingId === convo.id ? (
							<input
								ref={renameRef}
								value={renameValue}
								onChange={(e) => setRenameValue(e.target.value)}
								onBlur={() => commitRename(convo.id)}
								onKeyDown={(e) => {
									if (e.key === 'Enter')
										commitRename(convo.id);
									if (e.key === 'Escape') setRenamingId(null);
								}}
								className='flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-blue-500 dark:border-blue-400 text-slate-900 dark:text-white pb-px'
							/>
						) : (
							<button
								onClick={() =>
									router.push(`/dashboard/${convo.id}`)
								}
								className='flex-1 min-w-0 text-left truncate'
							>
								{convo.title}
							</button>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger
								onClick={(e) => e.stopPropagation()}
								className={cn(
									'shrink-0 rounded-md p-1 transition-opacity text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer',
									renamingId === convo.id
										? 'invisible'
										: 'opacity-0 group-hover:opacity-100',
								)}
							>
								<MoreHorizontal className='h-3.5 w-3.5' />
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side='right'
								align='start'
								sideOffset={6}
							>
								<DropdownMenuItem
									onClick={() => startRename(convo)}
									className='cursor-pointer'
								>
									<Pencil className='h-3.5 w-3.5' />
									Rename
								</DropdownMenuItem>
								<DropdownMenuItem
									variant='destructive'
									onClick={() => handleDelete(convo.id)}
									className='cursor-pointer'
								>
									<Trash2 className='h-3.5 w-3.5' />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				))}
			</nav>
		</aside>
	);
}
