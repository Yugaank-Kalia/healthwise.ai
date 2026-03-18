import ChatView from '@/components/chat-view';

export default async function ConversationPage({
	params,
}: {
	params: Promise<{ conversationId: string }>;
}) {
	const { conversationId } = await params;
	return <ChatView conversationId={conversationId} />;
}
