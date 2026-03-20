'use client';

import Link from 'next/link';
import UserButton from './user-button';
import ThemeToggle from './theme-toggle';
import MobileConversationsMenu from './mobile-conversations-menu';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function Navbar() {
	const pathName = usePathname();

	const { data: session, isPending } = authClient.useSession();
	const isAuthPage = pathName.includes('/sign');

	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<nav className='flex items-center justify-between p-5 mx-auto w-full'>
			<Link href='/'>
				<span className='text-lg font-bold text-blue-900 dark:text-blue-300 tracking-tight'>
					healthwise.ai
				</span>
			</Link>
			{!isAuthPage && (
				<div className='flex items-center gap-3'>
					<MobileConversationsMenu />
					<ThemeToggle />
					{!mounted || isPending ? (
						<Skeleton className='h-8 w-8 rounded-full' />
					) : session ? (
						<UserButton />
					) : (
						<>
							<Link
								href='/sign-in'
								className='text-sm font-medium text-blue-900 dark:text-blue-300 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors'
							>
								Sign in
							</Link>
							<Link
								href='/sign-up'
								className='rounded-full bg-blue-900 px-3 py-1.5 text-sm text-white font-medium hover:bg-blue-800 transition-colors'
							>
								Sign up
							</Link>
						</>
					)}
				</div>
			)}
		</nav>
	);
}
