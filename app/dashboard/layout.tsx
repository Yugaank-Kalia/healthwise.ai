import ChatSidebar from '@/components/chat-sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex-1 min-h-0 flex overflow-hidden'>
			<ChatSidebar />
			<main className='flex-1 min-w-0 flex flex-col'>{children}</main>
		</div>
	);
}
