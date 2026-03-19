import { db } from '@/src/db';
import { betterAuth } from 'better-auth';
import * as schema from '@/src/db/schemas/schema';
import * as authSchema from '@/src/db/schemas/auth-schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			...authSchema,
			...schema,
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
