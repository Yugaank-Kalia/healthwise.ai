import { db } from '@/src/db';
import { recipes } from '@/src/db/schemas/nutrition-schema';

const API_KEY = process.env.SPOONACULAR_API_KEY as string;
const BASE = 'https://api.spoonacular.com/recipes/complexSearch';

function toSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}

async function fetchRecipes(diet: string | null, count = 10) {
	const params = new URLSearchParams({
		number: String(count),
		addRecipeInformation: 'true',
		addRecipeNutrition: 'true',
		instructionsRequired: 'true',
		sort: 'healthiness',
		sortDirection: 'desc',
		apiKey: API_KEY,
	});
	if (diet) params.set('diet', diet);

	const res = await fetch(`${BASE}?${params}`);
	if (!res.ok)
		throw new Error(`Spoonacular error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	return data.results as any[];
}

function mapRecipe(r: any, category: 'meat' | 'vegan' | 'vegetarian') {
	const calorieNutrient = r.nutrition?.nutrients?.find(
		(n: any) => n.name === 'Calories',
	);
	const ingredients: string[] =
		r.extendedIngredients?.map((i: any) => i.original as string) ?? [];
	const instructions: string[] =
		r.analyzedInstructions?.[0]?.steps?.map((s: any) => s.step as string) ??
		[];

	return {
		id: toSlug(r.title),
		title: r.title as string,
		description: r.summary ? stripHtml(r.summary).slice(0, 400) : null,
		category,
		prepTime: r.readyInMinutes != null ? String(r.readyInMinutes) : null,
		calories: calorieNutrient
			? String(Math.round(calorieNutrient.amount))
			: null,
		ingredients: ingredients.length ? ingredients : null,
		instructions: instructions.length ? instructions : null,
		imageUrl: r.image
			? (r.image as string).replace(/\d+x\d+/, '636x393')
			: null,
	};
}

async function main() {
	if (!API_KEY) {
		console.error('SPOONACULAR_API_KEY is not set in .env');
		process.exit(1);
	}

	console.log('Fetching meat/healthy recipes...');
	// No diet filter → omnivore; sort by healthiness to keep them healthy
	const meat = await fetchRecipes(null);

	await new Promise((r) => setTimeout(r, 2000));

	console.log('Fetching vegetarian recipes...');
	const vegetarian = await fetchRecipes('vegetarian');

	await new Promise((r) => setTimeout(r, 2000));

	console.log('Fetching vegan recipes...');
	const vegan = await fetchRecipes('vegan');

	const rows = [
		...vegan.map((r) => mapRecipe(r, 'vegan')),
		...vegetarian.map((r) => mapRecipe(r, 'vegetarian')),
		...meat.map((r) => mapRecipe(r, 'meat')),
	];

	console.log(`Inserting ${rows.length} recipes...`);
	await db.insert(recipes).values(rows).onConflictDoNothing();
	console.log('Done!');
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
