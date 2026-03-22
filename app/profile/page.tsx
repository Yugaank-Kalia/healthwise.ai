'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';

const pwSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters'),
		confirmPassword: z.string().min(1, 'Please confirm your password'),
	})
	.refine((d) => d.newPassword === d.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

type PwValues = z.infer<typeof pwSchema>;

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
				{label}
			</label>
			{children}
		</div>
	);
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			{...props}
			className='w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition disabled:opacity-50'
		/>
	);
}

function Card({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className='rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/3 p-6 space-y-5'>
			<h2 className='text-base font-semibold text-slate-900 dark:text-white'>
				{title}
			</h2>
			{children}
		</section>
	);
}

export default function ProfilePage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	const [hasPassword, setHasPassword] = useState<boolean | null>(null);

	// Name
	const [name, setName] = useState('');
	const [nameStatus, setNameStatus] = useState<string | null>(null);
	const [nameSaving, setNameSaving] = useState(false);

	// Password
	const [pwSuccess, setPwSuccess] = useState(false);
	const {
		register: regPw,
		handleSubmit: handlePwSubmit,
		setError: setPwError,
		reset: resetPw,
		formState: { errors: pwErrors, isSubmitting: pwSaving },
	} = useForm<PwValues>({ resolver: zodResolver(pwSchema) });

	// Delete
	const [deleteConfirm, setDeleteConfirm] = useState(false);
	const [deleteInput, setDeleteInput] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	useEffect(() => {
		if (session) setName(session.user.name ?? '');
	}, [session]);

	useEffect(() => {
		fetch('/api/user')
			.then((r) => r.json())
			.then((d) => setHasPassword(d.hasPassword ?? false))
			.catch(() => setHasPassword(false));
	}, []);

	if (isPending || hasPassword === null) {
		return (
			<div className='flex flex-1 items-center justify-center'>
				<div className='h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin' />
			</div>
		);
	}

	if (!session) {
		router.push('/sign-up');
		return null;
	}

	async function saveName(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		setNameSaving(true);
		setNameStatus(null);
		const { error } = await authClient.updateUser({ name: trimmed });
		setNameSaving(false);
		setNameStatus(
			error
				? (error.message ?? 'Failed to update name.')
				: 'Name updated.',
		);
	}

	async function savePassword({ currentPassword, newPassword }: PwValues) {
		const { error } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true,
		});
		if (error) {
			setPwError('root', {
				message: error.message ?? 'Failed to change password.',
			});
		} else {
			setPwSuccess(true);
			resetPw();
		}
	}

	async function deleteAccount() {
		setDeleting(true);
		setDeleteError(null);
		const { error } = await authClient.deleteUser({
			callbackURL: '/',
		});
		if (error) {
			setDeleteError(error.message ?? 'Failed to delete account.');
			setDeleting(false);
		} else {
			router.push('/');
		}
	}

	return (
		<div className='flex flex-1 items-start justify-center px-4 py-12 sm:py-20'>
			<div className='w-full max-w-lg space-y-6'>
				<div>
					<h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
						Profile
					</h1>
					<p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
						{session.user.email}
					</p>
				</div>

				{/* Name */}
				<Card title='Display name'>
					<form onSubmit={saveName} className='space-y-4'>
						<Field label='Name'>
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder='Your name'
								disabled={nameSaving}
							/>
						</Field>
						{nameStatus && (
							<p
								className={`text-sm ${nameStatus !== 'Name updated.' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
							>
								{nameStatus}
							</p>
						)}
						<button
							type='submit'
							disabled={
								nameSaving ||
								!name.trim() ||
								name.trim() === session.user.name
							}
							className='rounded-full bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed'
						>
							{nameSaving ? 'Saving…' : 'Save'}
						</button>
					</form>
				</Card>

				{/* Password */}
				{hasPassword ? (
					<Card title='Change password'>
						<form
							onSubmit={handlePwSubmit(savePassword)}
							className='space-y-4'
						>
							<Field label='Current password'>
								<Input
									type='password'
									{...regPw('currentPassword')}
									placeholder='••••••••'
									disabled={pwSaving}
								/>
								{pwErrors.currentPassword && (
									<p className='mt-1 text-xs text-red-500'>
										{pwErrors.currentPassword.message}
									</p>
								)}
							</Field>
							<Field label='New password'>
								<Input
									type='password'
									{...regPw('newPassword')}
									placeholder='••••••••'
									disabled={pwSaving}
								/>
								{pwErrors.newPassword && (
									<p className='mt-1 text-xs text-red-500'>
										{pwErrors.newPassword.message}
									</p>
								)}
							</Field>
							<Field label='Confirm new password'>
								<Input
									type='password'
									{...regPw('confirmPassword')}
									placeholder='••••••••'
									disabled={pwSaving}
								/>
								{pwErrors.confirmPassword && (
									<p className='mt-1 text-xs text-red-500'>
										{pwErrors.confirmPassword.message}
									</p>
								)}
							</Field>
							{pwErrors.root && (
								<p className='text-sm text-red-500'>
									{pwErrors.root.message}
								</p>
							)}
							{pwSuccess && (
								<p className='text-sm text-green-600 dark:text-green-400'>
									Password updated.
								</p>
							)}
							<button
								type='submit'
								disabled={pwSaving}
								className='rounded-full bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed'
							>
								{pwSaving ? 'Saving…' : 'Update password'}
							</button>
						</form>
					</Card>
				) : (
					<Card title='Password'>
						<p className='text-sm text-slate-500 dark:text-slate-400'>
							You signed in with Google. Password changes are
							managed through your Google account.
						</p>
					</Card>
				)}

				{/* Delete account */}
				<Card title='Delete account'>
					{!deleteConfirm ? (
						<div className='space-y-3'>
							<p className='text-sm text-slate-500 dark:text-slate-400'>
								Permanently delete your account and all
								conversations. This cannot be undone.
							</p>
							<button
								onClick={() => setDeleteConfirm(true)}
								className='rounded-full border border-red-300 dark:border-red-800 px-5 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer'
							>
								Delete account
							</button>
						</div>
					) : (
						<div className='space-y-4'>
							<p className='text-sm text-slate-700 dark:text-slate-300'>
								Type{' '}
								<span className='font-mono font-semibold text-slate-900 dark:text-white'>
									delete my account
								</span>{' '}
								to confirm.
							</p>
							<Input
								value={deleteInput}
								onChange={(e) => setDeleteInput(e.target.value)}
								placeholder='delete my account'
								disabled={deleting}
							/>
							{deleteError && (
								<p className='text-sm text-red-500'>
									{deleteError}
								</p>
							)}
							<div className='flex gap-3'>
								<button
									onClick={deleteAccount}
									disabled={
										deleting ||
										deleteInput !== 'delete my account'
									}
									className='rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed'
								>
									{deleting ? 'Deleting…' : 'Confirm delete'}
								</button>
								<button
									onClick={() => {
										setDeleteConfirm(false);
										setDeleteInput('');
										setDeleteError(null);
									}}
									className='rounded-full px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8 transition-colors cursor-pointer'
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
