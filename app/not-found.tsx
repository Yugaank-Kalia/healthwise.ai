import Link from 'next/link';

export default function NotFound() {
	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-background text-center">
			<div className="flex flex-col items-center gap-2">
				<span className="text-[7rem] font-bold leading-none tracking-tight text-foreground/10 select-none">
					404
				</span>
				<h1 className="text-xl font-semibold text-foreground">
					Page not found
				</h1>
				<p className="max-w-xs text-sm text-muted-foreground">
					This conversation doesn't exist or may have been deleted.
				</p>
			</div>
			<Link
				href="/dashboard"
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
			>
				Back to dashboard
			</Link>
		</div>
	);
}
