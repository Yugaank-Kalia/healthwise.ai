"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";

const UserAvatar = () => {
	const { user } = useUser();

	return (
		<div>
			<Avatar className='h-12 w-12'>
				<AvatarImage src={user?.imageUrl} />
			</Avatar>
		</div>
	);
};

export default UserAvatar;
