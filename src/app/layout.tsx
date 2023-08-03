import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "healthwise.ai",
	description: "Medical Diagnoses App",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider appearance={{ baseTheme: dark }}>
			<html lang='en'>
				<body className={inter.className}>
					{children}
					<Toaster />
				</body>
			</html>
		</ClerkProvider>
	);
}
