import ChatForm from './components/chat-form';
import ChatHeader from './components/chat-header';

const ChatClient = () => {
	return (
		<div className='h-full p-4 space-y-2'>
			<ChatHeader />
			<ChatForm />
		</div>
	);
};

export default ChatClient;
