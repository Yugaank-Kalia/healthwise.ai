import { notFound } from 'next/navigation';
import ChatView from '@/components/chat-view';

export default async function ConversationPage({
	params,
}: {
	params: Promise<{ conversationId: string }>;
}) {
	const { conversationId } = await params;

	const uuidRe =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRe.test(conversationId)) notFound();

	return <ChatView conversationId={conversationId} key={conversationId} />;
}
