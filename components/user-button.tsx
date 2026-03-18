'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';

export default function UserButton() {
	const router = useRouter();
	const { data: session } = authClient.useSession();

	if (!session) return null;

	const { user } = session;
	const initials = user.name
		? user.name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: user.email[0].toUpperCase();

	async function handleSignOut() {
		await authClient.signOut();
		router.push('/sign-in');
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className='rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[oklch(0.14_0.03_258)]'>
				<Avatar className='h-8 w-8 cursor-pointer'>
					<AvatarImage
						src={user.image ?? undefined}
						alt={user.name ?? user.email}
					/>
					<AvatarFallback className='bg-blue-900 text-white text-xs font-semibold'>
						{initials}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-56'>
				<div className='px-2 py-1.5'>
					<p className='text-sm font-medium text-slate-900 dark:text-white truncate'>
						{user.name}
					</p>
					<p className='text-xs text-slate-500 dark:text-slate-400 truncate'>
						{user.email}
					</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => router.push('/profile')}
					className='cursor-pointer'
				>
					<User className='mr-2 h-4 w-4' />
					Profile
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleSignOut}
					className='cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400'
				>
					<LogOut className='mr-2 h-4 w-4' />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
