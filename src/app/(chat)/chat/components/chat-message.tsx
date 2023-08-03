"use client";

import { cn } from "@/lib/utils";
import BotAvatar from "./bot-avatar";
import UserAvatar from "./user-avatar";

import Typewriter from "react-ts-typewriter";
import { BeatLoader } from "react-spinners";

export interface ChatMessageProps {
	role: "assistant" | "user";
	content?: string;
	isLoading?: boolean;
}

const ChatMessage = ({ role, content, isLoading }: ChatMessageProps) => {
	return (
		<div
			className={cn(
				"group flex items-start gap-x-3 py-4 w-full",
				role === "user" && "justify-end"
			)}
		>
			{role !== "user" && (
				<BotAvatar src='https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg?w=360' />
			)}
			<div className='rounded-md px-4 py-2 max-w-sm text-sm bg-primary/10'>
				{isLoading && role === "assistant" ? (
					<BeatLoader size={5} />
				) : (
					<p className='whitespace-pre-line'>
						{eval("`" + content?.replace(/"/g, "") + "`")}
					</p>
				)}
			</div>
			{role === "user" && <UserAvatar />}
		</div>
	);
};

export default ChatMessage;
