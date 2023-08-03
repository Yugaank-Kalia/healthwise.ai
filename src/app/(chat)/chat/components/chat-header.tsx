"use client";

import { useRouter } from "next/navigation";

import BotAvatar from "./bot-avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessagesSquare } from "lucide-react";

const ChatHeader = () => {
	const router = useRouter();

	return (
		<div className='flex w-full justify-between items-center border-b border-primary/10 pb-4'>
			<div className='flex gap-x-2 items-center'>
				<Button size='icon' variant='ghost'>
					<ChevronLeft
						className='h-8 w-8'
						onClick={() => router.push("/")}
					/>
				</Button>
				<BotAvatar src='https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg?w=360' />
				<div className='flex flex-col gap-y-1'>
					<div className='flex items-center gap-x-2'>
						<p className='font-bold'>Doctor GPT</p>
						<p className='font-extralight'>
							{`{ Not a replacement for a doctor }`}
						</p>
						<div className='flex items-center text-xs text-muted-foreground'>
							<MessagesSquare className='w-5 h-5 mr-1' />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatHeader;
