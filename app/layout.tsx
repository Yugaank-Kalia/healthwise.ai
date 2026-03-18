import './globals.css';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import Navbar from '@/components/navbar';
import { ThemeProvider } from '@/providers/theme-provider';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
	subsets: ['latin'],
	weight: ['300', '400', '500', '600', '700'],
	variable: '--font-sans',
});

const geistMono = Geist({
	subsets: ['latin'],
	weight: ['400', '500'],
	variable: '--font-mono',
});

export const metadata: Metadata = {
	title: 'healthwise.ai — Your Nutrition Companion',
	description:
		'Personalized nutrition guidance backed by NIH research. Make smarter food choices with science-driven insights.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang='en'
			className={cn(geistSans.variable, geistMono.variable)}
			suppressHydrationWarning
		>
			<body className='antialiased h-screen flex flex-col'>
				<ThemeProvider
					attribute='class'
					defaultTheme='light'
					enableSystem
					disableTransitionOnChange
				>
					<Navbar />
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
