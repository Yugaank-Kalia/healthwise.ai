import { db } from '@/src/db';
import { betterAuth } from 'better-auth';
import * as authSchema from '@/src/db/schemas/auth-schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as nutritionSchema from '@/src/db/schemas/nutrition-schema';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			...authSchema,
			...nutritionSchema,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	user: {
		deleteUser: {
			enabled: true,
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
});
