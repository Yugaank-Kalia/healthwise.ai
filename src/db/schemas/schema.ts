import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	vector,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// ─── nih_papers ───────────────────────────────────────────────────────────────

export const nihPapers = pgTable('nih_papers', {
	id: uuid('id').primaryKey().defaultRandom(),
	pmid: text('pmid').notNull().unique(),
	pmcId: text('pmc_id'),
	title: text('title').notNull(),
	authors: text('authors'),
	journal: text('journal'),
	year: integer('year'),
	doi: text('doi'),
	abstract: text('abstract'),
	publicationType: text('publication_type'),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow(),
});

// ─── nih_chunks ───────────────────────────────────────────────────────────────

export const nihChunks = pgTable(
	'nih_chunks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		paperId: uuid('paper_id')
			.notNull()
			.references(() => nihPapers.id, { onDelete: 'cascade' }),
		chunkIndex: integer('chunk_index').notNull(),
		content: text('content').notNull(),
		section: text('section'),
		tokenCount: integer('token_count'),
		embedding: vector('embedding', { dimensions: 768 }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	},
	(table) => [
		uniqueIndex('nih_chunks_paper_chunk_idx').on(
			table.paperId,
			table.chunkIndex,
		),
		index('nih_chunks_embedding_idx').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
);

// ─── search_queries ───────────────────────────────────────────────────────────

export const searchQueries = pgTable('search_queries', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	query: text('query').notNull(),
	pubmedQuery: text('pubmed_query'),
	meshTerms: text('mesh_terms').array(),
	cacheHit: boolean('cache_hit').default(false),
	chunksUsed: integer('chunks_used'),
	responseTime: integer('response_time'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── query_citations ──────────────────────────────────────────────────────────

export const queryCitations = pgTable(
	'query_citations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		queryId: uuid('query_id')
			.notNull()
			.references(() => searchQueries.id, { onDelete: 'cascade' }),
		paperId: uuid('paper_id')
			.notNull()
			.references(() => nihPapers.id, { onDelete: 'cascade' }),
		relevanceScore: real('relevance_score'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	},
	(table) => [
		uniqueIndex('query_citations_query_paper_idx').on(
			table.queryId,
			table.paperId,
		),
	],
);

// ─── conversations ────────────────────────────────────────────────────────────

export const conversations = pgTable(
	'conversations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('conversations_userId_idx').on(table.userId)],
);

// ─── messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
	'messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['user', 'assistant'] }).notNull(),
		content: text('content').notNull(),
		status: text('status', { enum: ['pending', 'done', 'error'] }).default('done').notNull(),
		citations: jsonb('citations'),
		sources: jsonb('sources'),
		meta: jsonb('meta'),
		order: integer('order').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index('messages_conversationId_idx').on(table.conversationId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const nihPapersRelations = relations(nihPapers, ({ many }) => ({
	chunks: many(nihChunks),
	citations: many(queryCitations),
}));

export const nihChunksRelations = relations(nihChunks, ({ one }) => ({
	paper: one(nihPapers, {
		fields: [nihChunks.paperId],
		references: [nihPapers.id],
	}),
}));

export const searchQueriesRelations = relations(
	searchQueries,
	({ one, many }) => ({
		user: one(user, {
			fields: [searchQueries.userId],
			references: [user.id],
		}),
		citations: many(queryCitations),
	}),
);

export const queryCitationsRelations = relations(queryCitations, ({ one }) => ({
	query: one(searchQueries, {
		fields: [queryCitations.queryId],
		references: [searchQueries.id],
	}),
	paper: one(nihPapers, {
		fields: [queryCitations.paperId],
		references: [nihPapers.id],
	}),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsertNihPaper = typeof nihPapers.$inferInsert;
export type SelectNihPaper = typeof nihPapers.$inferSelect;

export type InsertNihChunk = typeof nihChunks.$inferInsert;
export type SelectNihChunk = typeof nihChunks.$inferSelect;

export type InsertSearchQuery = typeof searchQueries.$inferInsert;
export type SelectSearchQuery = typeof searchQueries.$inferSelect;

export type InsertQueryCitation = typeof queryCitations.$inferInsert;
export type SelectQueryCitation = typeof queryCitations.$inferSelect;

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
	user: one(user, {
		fields: [conversations.userId],
		references: [user.id],
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id],
	}),
}));

export type InsertConversation = typeof conversations.$inferInsert;
export type SelectConversation = typeof conversations.$inferSelect;

export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
