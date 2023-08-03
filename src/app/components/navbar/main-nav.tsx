import { Navbar } from "./navbar";
import { Button } from "@/components/ui/button";
import {
	UserButton,
	currentUser,
	SignInButton,
	SignUpButton,
} from "@clerk/nextjs";

const MainNav = async () => {
	const user = await currentUser();

	return (
		<div className='hidden flex-col md:flex bg-slate-700'>
			<div className='border-b'>
				<div className='flex h-20 items-center px-4'>
					<Navbar className='mx-6' />
					<div className='ml-auto flex items-center space-x-4'>
						{user ? (
							<UserButton afterSignOutUrl='/' />
						) : (
							<div className='flex flex-row gap-3'>
								<Button className='bg-white text-black hover:bg-slate-300'>
									<SignInButton />
								</Button>
								<Button className='bg-white text-black hover:bg-slate-300'>
									<SignUpButton />
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default MainNav;
