import { Avatar, AvatarImage } from "@/components/ui/avatar";

interface BotAvatarProps {
	src: string;
}

const BotAvatar = ({ src }: BotAvatarProps) => {
	return (
		<div>
			<Avatar className='h-12 w-12'>
				<AvatarImage src='https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg?w=360' />
			</Avatar>
		</div>
	);
};

export default BotAvatar;
