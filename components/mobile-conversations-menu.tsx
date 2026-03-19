'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MoreVertical, MessageSquarePlus } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuGroup,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Conversation = { id: string; title: string };

export default function MobileConversationsMenu() {
	const pathname = usePathname();
	const router = useRouter();
	const [conversations, setConversations] = useState<Conversation[]>([]);

	const isDashboard = pathname.startsWith('/dashboard');

	const fetchConversations = useCallback(async () => {
		const res = await fetch('/api/conversations');
		if (res.ok) setConversations(await res.json());
	}, []);

	useEffect(() => {
		if (isDashboard) fetchConversations();
	}, [isDashboard, fetchConversations]);

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
		return () => window.removeEventListener('conversation-renamed', handler);
	}, []);

	if (!isDashboard) return null;

	const activeId = pathname.startsWith('/dashboard/')
		? pathname.split('/dashboard/')[1]
		: null;

	async function handleNewChat() {
		const res = await fetch('/api/conversations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Chat' }),
		});
		const convo = await res.json();
		router.push(`/dashboard/${convo.id}`);
		window.dispatchEvent(new CustomEvent('sidebar-refresh'));
	}

	return (
		<div className='sm:hidden'>
			<DropdownMenu>
				<DropdownMenuTrigger className='p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 cursor-pointer'>
					<MoreVertical className='h-4 w-4' />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side='bottom'
					align='end'
					className='min-w-56 max-h-80 overflow-y-auto'
				>
					<DropdownMenuItem
						onClick={handleNewChat}
						className='cursor-pointer'
					>
						<MessageSquarePlus className='h-4 w-4' />
						New Chat
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Conversations</DropdownMenuLabel>
						{conversations.length === 0 ? (
							<p className='px-2 py-2 text-xs text-slate-400 dark:text-slate-500'>
								No conversations yet
							</p>
						) : (
							conversations.map((convo) => (
								<DropdownMenuItem
									key={convo.id}
									onClick={() =>
										router.push(`/dashboard/${convo.id}`)
									}
								className={cn(
									'cursor-pointer',
									activeId === convo.id && 'bg-accent',
								)}
							>
								<span className='truncate'>{convo.title}</span>
							</DropdownMenuItem>
						))
						)}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
