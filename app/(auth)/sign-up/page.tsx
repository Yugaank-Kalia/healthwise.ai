'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GoogleButton from '@/components/google-button';
import { authClient } from '@/lib/auth-client';

const schema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.email('Enter a valid email'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function SignUpPage() {
	const router = useRouter();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({ resolver: zodResolver(schema) });

	async function onSubmit({ name, email, password }: FormValues) {
		const { error } = await authClient.signUp.email({
			name,
			email,
			password,
			callbackURL: '/dashboard',
		});
		if (error) {
			setError('root', { message: error.message ?? 'Sign up failed.' });
		} else {
			router.push('/dashboard');
		}
	}

	return (
		<div className='flex flex-1 items-center justify-center px-8 py-24'>
			<div className='w-full max-w-sm'>
				<div className='mb-8 text-center'>
					<h1 className='mt-6 text-2xl font-bold text-slate-900 dark:text-white'>
						Create an account
					</h1>
					<p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>
						Start your nutrition journey today
					</p>
				</div>

				<GoogleButton label='Continue with Google' />

				<div className='relative my-5'>
					<div className='absolute inset-0 flex items-center'>
						<div className='w-full border-t border-slate-200 dark:border-white/10' />
					</div>
					<div className='relative flex justify-center'>
						<span className='bg-white dark:bg-[oklch(0.14_0.03_258)] px-3 text-xs text-slate-400'>
							or
						</span>
					</div>
				</div>

				<form className='space-y-4' onSubmit={handleSubmit(onSubmit)}>
					<div>
						<label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
							Name
						</label>
						<input
							type='text'
							placeholder='Jane Smith'
							{...register('name')}
							className='w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition'
						/>
						{errors.name && (
							<p className='mt-1 text-xs text-red-500'>{errors.name.message}</p>
						)}
					</div>
					<div>
						<label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
							Email
						</label>
						<input
							type='email'
							placeholder='you@example.com'
							{...register('email')}
							className='w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition'
						/>
						{errors.email && (
							<p className='mt-1 text-xs text-red-500'>{errors.email.message}</p>
						)}
					</div>
					<div>
						<label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
							Password
						</label>
						<input
							type='password'
							placeholder='••••••••'
							{...register('password')}
							className='w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition'
						/>
						{errors.password && (
							<p className='mt-1 text-xs text-red-500'>{errors.password.message}</p>
						)}
					</div>
					{errors.root && (
						<p className='text-sm text-red-500'>{errors.root.message}</p>
					)}
					<button
						type='submit'
						disabled={isSubmitting}
						className='w-full rounded-full bg-blue-900 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors disabled:opacity-60'
					>
						{isSubmitting ? 'Creating account…' : 'Create account'}
					</button>
				</form>

				<p className='mt-6 text-center text-sm text-slate-500 dark:text-slate-400'>
					Already have an account?{' '}
					<Link
						href='/sign-in'
						className='font-medium text-blue-800 dark:text-blue-400 hover:opacity-70 transition-opacity'
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
