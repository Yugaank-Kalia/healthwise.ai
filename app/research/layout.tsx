import ResearchSidebar from '@/components/research-sidebar';

export default function ResearchLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className='flex-1 min-h-0 flex overflow-hidden'>
			<ResearchSidebar />
			<main className='flex-1 min-w-0 flex flex-col'>{children}</main>
		</div>
	);
}
