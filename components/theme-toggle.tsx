'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	if (!mounted) return <div className='w-9 h-9' />;

	const isDark = theme === 'dark';

	return (
		<Button
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			aria-label='Toggle theme'
			className='relative flex items-center justify-center w-9 h-9 rounded-full border border-blue-100 dark:border-blue-900/50 bg-white dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors duration-200'
		>
			<Sun
				className={`absolute w-4 h-4 transition-all duration-300 ${
					isDark
						? 'opacity-100 rotate-0 scale-100'
						: 'opacity-0 rotate-90 scale-50'
				}`}
			/>
			<Moon
				className={`absolute w-4 h-4 transition-all duration-300 ${
					isDark
						? 'opacity-0 -rotate-90 scale-50'
						: 'opacity-100 rotate-0 scale-100'
				}`}
			/>
		</Button>
	);
}
