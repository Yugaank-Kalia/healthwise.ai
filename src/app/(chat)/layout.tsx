import { ReactNode } from "react";

const ChatLayout = ({ children }: { children: ReactNode }) => {
	return <div className='mx-auto max-w-4xl h-full'>{children}</div>;
};

export default ChatLayout;
