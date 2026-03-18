import { CopyrightIcon } from 'lucide-react';

export default async function Home() {
	return (
		<div className='min-h-screen bg-white dark:bg-[oklch(0.14_0.03_258)] font-sans flex flex-col'>
			{/* Hero */}
			<section className='flex-1 flex flex-col items-center justify-center text-center px-8 py-24 max-w-3xl mx-auto w-full'>
				<span className='inline-block mb-5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-4 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider'>
					Backed by NIH Research
				</span>
				<h1 className='text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight mb-6'>
					Your personal
					<br />
					<span className='text-blue-800 dark:text-blue-400'>
						nutrition companion
					</span>
				</h1>
				<p className='text-lg text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed mb-10'>
					Personalized nutrition guidance powered by National
					Institutes of Health research, so you can eat smarter and
					live better.
				</p>
				<div className='flex flex-col sm:flex-row gap-3 justify-center'>
					<a
						href='/dashboard'
						className='rounded-full bg-blue-900 px-8 py-3.5 text-white font-semibold text-sm hover:bg-blue-800 transition-colors shadow-sm'
					>
						Start for free
					</a>
					<a
						href='#'
						className='rounded-full border border-slate-200 dark:border-slate-700 px-8 py-3.5 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors'
					>
						Learn more
					</a>
				</div>
				<p className='mt-6 text-base font-semibold text-slate-400 dark:text-slate-500'>
					Not a substitute for professional medical advice.
				</p>
			</section>

			{/* Footer */}
			<footer className='border-t border-slate-100 dark:border-white/10 py-6 px-8'>
				<div className='max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-400'>
					<span className='font-semibold text-blue-900 dark:text-blue-400'>
						healthwise.ai
					</span>
					<span className='flex items-center gap-1'>
						<CopyrightIcon /> {new Date().getFullYear()}{' '}
						healthwise.ai
					</span>
				</div>
			</footer>
		</div>
	);
}
