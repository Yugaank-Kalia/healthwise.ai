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
	title: {
		default: 'healthwise.ai - Your Nutrition Companion',
		template: '%s · healthwise.ai',
	},
	description:
		'Personalized nutrition guidance backed by NIH research. Make smarter food choices with science-driven insights.',
	metadataBase: new URL('https://healthwise.ai'),
	openGraph: {
		type: 'website',
		siteName: 'healthwise.ai',
		title: 'healthwise.ai - Your Nutrition Companion',
		description:
			'Personalized nutrition guidance backed by NIH research. Make smarter food choices with science-driven insights.',
		url: 'https://healthwise.ai',
		images: [
			{
				url: '/og-image.png',
				width: 1200,
				height: 630,
				alt: 'healthwise.ai - Your Nutrition Companion',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'healthwise.ai - Your Nutrition Companion',
		description:
			'Personalized nutrition guidance backed by NIH research. Make smarter food choices with science-driven insights.',
		images: ['/og-image.png'],
	},
	icons: {
		icon: '/favicon.ico',
		apple: '/apple-touch-icon.png',
	},
	robots: {
		index: true,
		follow: true,
	},
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
