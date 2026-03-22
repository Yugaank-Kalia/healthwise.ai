'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Flame } from 'lucide-react';

type Recipe = {
	id: string;
	title: string;
	description: string | null;
	category: string;
	prepTime: string | null;
	calories: string | null;
	imageUrl: string | null;
	ingredients: string[] | null;
	instructions: string[] | null;
};

const numberedItem = (index: number, text: string) => (
	<li key={index} className='flex items-start gap-3 text-sm text-foreground'>
		<span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-900 text-xs font-medium text-white dark:bg-blue-300 dark:text-blue-950'>
			{index + 1}
		</span>
		{text}
	</li>
);

export default function RecipeDetailPage() {
	const { recipeId } = useParams<{ recipeId: string }>();
	const router = useRouter();
	const [recipe, setRecipe] = useState<Recipe | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		fetch(`/api/recipes/${recipeId}`)
			.then(async (r) => {
				if (!r.ok) {
					setNotFound(true);
					return;
				}
				setRecipe(await r.json());
			})
			.catch(() => setNotFound(true))
			.finally(() => setLoading(false));
	}, [recipeId]);

	if (loading) return <RecipeSkeleton />;

	if (notFound || !recipe) {
		return (
			<div className='flex flex-1 flex-col items-center justify-center gap-3'>
				<p className='text-sm text-muted-foreground'>
					Recipe not found.
				</p>
				<Button variant='outline' onClick={() => router.back()}>
					Go back
				</Button>
			</div>
		);
	}

	console.log(recipe.instructions);
	const instructionSteps = recipe.instructions?.filter(Boolean) ?? [];

	return (
		<div className='flex flex-1 flex-col overflow-y-auto'>
			{recipe.imageUrl ? (
				<img
					src={recipe.imageUrl}
					alt={recipe.title}
					className='h-64 w-full object-cover'
				/>
			) : (
				<div className='h-64 w-full bg-accent' />
			)}

			<div className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8'>
				<button
					onClick={() => router.back()}
					className='flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
				>
					<ArrowLeft className='h-4 w-4' />
					Back
				</button>

				<div className='flex flex-col gap-3'>
					<span className='text-xs font-medium uppercase tracking-widest text-muted-foreground'>
						{recipe.category}
					</span>
					<h1 className='text-2xl font-semibold text-foreground'>
						{recipe.title}
					</h1>
					{recipe.description && (
						<p className='text-sm leading-relaxed text-muted-foreground'>
							{recipe.description}
						</p>
					)}
					<div className='flex items-center gap-4 text-sm text-muted-foreground'>
						{recipe.prepTime && (
							<span className='flex items-center gap-1.5'>
								<Clock className='h-4 w-4' />
								{recipe.prepTime} mins
							</span>
						)}
						{recipe.calories && (
							<span className='flex items-center gap-1.5'>
								<Flame className='h-4 w-4' fill='orange' />
								{recipe.calories} cals
							</span>
						)}
					</div>
				</div>

				{recipe.ingredients && recipe.ingredients.length > 0 && (
					<div className='flex flex-col gap-3'>
						<h2 className='text-base font-semibold text-foreground'>
							Ingredients
						</h2>
						<ol className='flex flex-col gap-3'>
							{recipe.ingredients.map((item, i) =>
								numberedItem(i, item),
							)}
						</ol>
					</div>
				)}

				{instructionSteps.length > 0 && (
					<div className='flex flex-col gap-3'>
						<h2 className='text-base font-semibold text-foreground'>
							Instructions
						</h2>
						<ol className='flex flex-col gap-3'>
							{instructionSteps.map((step, i) =>
								numberedItem(i, step),
							)}
						</ol>
					</div>
				)}
			</div>
		</div>
	);
}

function RecipeSkeleton() {
	return (
		<div className='flex flex-1 flex-col overflow-y-auto'>
			<Skeleton className='h-64 w-full rounded-none' />
			<div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8'>
				<Skeleton className='h-4 w-16' />
				<Skeleton className='h-7 w-2/3' />
				<Skeleton className='h-4 w-full' />
				<Skeleton className='h-4 w-3/4' />
				<div className='mt-4 flex flex-col gap-2'>
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className='h-4 w-full' />
					))}
				</div>
			</div>
		</div>
	);
}
