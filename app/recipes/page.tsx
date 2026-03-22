'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Recipe = {
	id: string;
	title: string;
	description: string | null;
	category: 'meat' | 'vegan' | 'vegetarian';
	prepTime: string | null;
	calories: string | null;
	imageUrl: string | null;
};

const CATEGORIES: { slug: Recipe['category']; label: string }[] = [
	{ slug: 'meat', label: 'Meat' },
	{ slug: 'vegan', label: 'Vegan' },
	{ slug: 'vegetarian', label: 'Vegetarian' },
];

const PREVIEW_COUNT = 3;
const PAGE_SIZE = 6;
const MAX_W = 'mx-auto w-full max-w-5xl';

export default function RecipesPage() {
	const [recipesByCategory, setRecipesByCategory] = useState<
		Record<string, Recipe[]>
	>({});
	const [loading, setLoading] = useState(true);
	const [activeCategory, setActiveCategory] =
		useState<Recipe['category']>('meat');
	const [expanded, setExpanded] = useState(false);
	const [page, setPage] = useState(1);

	useEffect(() => {
		fetch('/api/recipes')
			.then((r) => r.json())
			.then((rows: Recipe[]) => {
				const grouped: Record<string, Recipe[]> = {
					vegan: [],
					meat: [],
					vegetarian: [],
				};
				for (const r of rows) grouped[r.category]?.push(r);
				setRecipesByCategory(grouped);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const allRecipes = recipesByCategory[activeCategory] ?? [];
	const totalPages = Math.ceil(allRecipes.length / PAGE_SIZE);

	const visibleRecipes = expanded
		? allRecipes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
		: allRecipes.slice(0, PREVIEW_COUNT);

	function switchCategory(slug: Recipe['category']) {
		setActiveCategory(slug);
		setExpanded(false);
		setPage(1);
	}

	function showMore() {
		setExpanded(true);
		setPage(1);
	}

	return (
		<div className='flex flex-1 flex-col overflow-y-auto'>
			{/* Top bar */}
			<div className='border-b border-border px-6 py-3'>
				<div className={`${MAX_W} flex items-center justify-between`}>
					<div className='flex items-center gap-1'>
						{CATEGORIES.map(({ slug, label }) => (
							<button
								key={slug}
								onClick={() => switchCategory(slug)}
								className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
									activeCategory === slug
										? 'bg-foreground text-background'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Grid */}
			<div className='px-6 py-8'>
				<div className={MAX_W}>
					{loading ? (
						<div className='grid grid-cols-3 gap-x-6 gap-y-10'>
							{Array.from({ length: PREVIEW_COUNT }).map(
								(_, i) => (
									<div
										key={i}
										className='flex flex-col gap-3'
									>
										<Skeleton className='aspect-square w-full rounded-lg' />
										<Skeleton className='h-5 w-3/4' />
										<Skeleton className='h-4 w-1/2' />
									</div>
								),
							)}
						</div>
					) : allRecipes.length === 0 ? (
						<div className='flex flex-col items-center justify-center gap-2 py-20 text-center'>
							<p className='text-sm text-muted-foreground'>
								No recipes yet.
							</p>
						</div>
					) : (
						<>
							<div className='grid grid-cols-3 gap-x-6 gap-y-10'>
								{visibleRecipes.map((recipe) => (
									<Link
										key={recipe.id}
										href={`/recipes/${recipe.id}`}
										className='group flex flex-col gap-3'
									>
										<div className='aspect-square w-full overflow-hidden rounded-lg bg-accent'>
											{recipe.imageUrl && (
												<img
													src={recipe.imageUrl}
													alt={recipe.title}
													className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
												/>
											)}
										</div>
										<div className='flex flex-col gap-1'>
											<h3 className='text-base font-semibold leading-snug text-foreground underline-offset-2 group-hover:underline'>
												{recipe.title}
											</h3>
											{recipe.description && (
												<p className='line-clamp-2 text-sm text-muted-foreground'>
													{recipe.description}
												</p>
											)}
											{(recipe.prepTime ||
												recipe.calories) && (
												<div className='mt-0.5 flex items-center gap-2 text-xs text-muted-foreground'>
													{recipe.prepTime && (
														<span>
															{recipe.prepTime}{' '}
															mins
														</span>
													)}
													{recipe.prepTime &&
														recipe.calories && (
															<span>·</span>
														)}
													{recipe.calories && (
														<span>
															{recipe.calories}{' '}
															cals
														</span>
													)}
												</div>
											)}
										</div>
									</Link>
								))}
							</div>

							{/* Show more / Pagination */}
							{!expanded && allRecipes.length > PREVIEW_COUNT && (
								<div className='mt-10 flex justify-center'>
									<button
										onClick={showMore}
										className='rounded-full border border-border px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent'
									>
										Show all {allRecipes.length} recipes
									</button>
								</div>
							)}

							{expanded && totalPages > 1 && (
								<div className='mt-10 flex items-center justify-center gap-3'>
									<button
										onClick={() =>
											setPage((p) => Math.max(1, p - 1))
										}
										disabled={page === 1}
										className='flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent disabled:opacity-40'
									>
										<ChevronLeft className='h-4 w-4' />
									</button>
									<span className='text-sm text-muted-foreground'>
										{page} / {totalPages}
									</span>
									<button
										onClick={() =>
											setPage((p) =>
												Math.min(totalPages, p + 1),
											)
										}
										disabled={page === totalPages}
										className='flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent disabled:opacity-40'
									>
										<ChevronRight className='h-4 w-4' />
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
