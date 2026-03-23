# healthwise.ai

AI-powered health and biomedical research assistant. Ask questions about nutrition, diet, and broader biomedical topics — answers are grounded in PubMed literature via a JIT (just in time) RAG pipeline, with follow-up suggestions to guide deeper exploration.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## How it works

1. **Query** - user submits a nutrition or biomedical question
2. **Cache check** - vector similarity search over previously ingested PubMed chunks
3. **Cache miss** - relevant papers are fetched from PubMed, chunked, embedded, and stored; the UI shows "Indexing papers…" during this step
4. **Reranking** - a cross-encoder (`BAAI/bge-reranker-base`) rescores all candidate chunks against the query and enforces source diversity (≥4 unique papers) before context is sent to the LLM
5. **Generation** - an LLM synthesizes an answer from the retrieved chunks, streamed token-by-token via SSE with inline `[PMID]` citations
6. **Follow-up suggestions** - the LLM generates contextual follow-up questions rendered as clickable chips below the response, letting users explore related topics without having to think of what to ask next
7. **Export to PDF** - a download button exports the full conversation as a formatted A4 PDF with citations, source links, and a disclaimer; generated client-side via `html2pdf.js`
8. **Persistence** - conversations and messages are stored per-user; in-flight responses survive page reloads - the server continues streaming regardless of client connection and the client resumes polling on reload
9. **Feedback** - users can rate each response with thumbs up/down; ratings are stored per-message and per-user for quality analysis

## Tech stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | Next.js 16 (App Router)                                 |
| Language      | TypeScript                                              |
| Styling       | Tailwind CSS v4, shadcn/ui                              |
| Auth          | better-auth (Google OAuth)                              |
| Database      | PostgreSQL via Supabase                                 |
| ORM           | Drizzle ORM                                             |
| Vector search | pgvector (cosine similarity, HNSW index)                |
| Embeddings    | HuggingFace - `NeuML/pubmedbert-base-embeddings` (768d) |
| LLM           | Ollama (configurable model via `QUERY_MODEL`)           |
| Literature    | NCBI PubMed E-utilities + PubMed Central full text      |
| PDF export    | html2pdf.js (client-side, dynamic import)               |

## Project structure

```
├── app/
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── api/
│   │   ├── ask/route.ts                          # SSE streaming endpoint - progress, meta, token, done events
│   │   ├── auth/[...all]/route.ts                # better-auth catch-all handler
│   │   ├── conversations/
│   │   │   ├── route.ts                          # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts                      # PATCH rename, DELETE
│   │   │       └── messages/
│   │   │           ├── route.ts                  # GET list, POST create
│   │   │           └── [messageId]/route.ts      # GET single, PATCH (polling target)
│   │   ├── ingest/route.ts                       # Manual ingest trigger
│   │   ├── pubmed/search/route.ts                # PubMed search proxy
│   │   └── search/route.ts                       # Vector similarity search
│   ├── dashboard/                                # Nutrition chat
│   │   ├── [conversationId]/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── research/                                 # Biomedical research chat
│   │   ├── [conversationId]/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── recipes/                                  # Recipe browser
│   │   ├── [recipeId]/page.tsx
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx                                # Root layout, OG metadata
│   └── page.tsx                                  # Marketing landing page
├── components/
│   ├── ui/                                       # shadcn/ui primitives
│   ├── chat-sidebar.tsx                          # Nutrition conversation list with rename/delete
│   ├── chat-view.tsx                             # Nutrition chat interface - SSE streaming, follow-up chips, sources drawer
│   ├── research-sidebar.tsx                      # Research conversation list
│   ├── research-chat-view.tsx                    # Biomedical research chat interface - follow-up chips, evidence levels
│   ├── google-button.tsx
│   ├── navbar.tsx
│   ├── theme-toggle.tsx
│   └── user-button.tsx
├── lib/
│   ├── pubmed/                                   # Shared PubMed utilities
│   │   ├── pubmed.ts                             # PubMed E-utilities client
│   │   ├── ingest.ts                             # Paper → chunk → embed → store
│   │   ├── search.ts                             # pgvector similarity search
│   │   ├── embeddings.ts                         # HuggingFace embedding client
│   │   ├── chunker.ts                            # Text chunking logic
│   │   └── pmc.ts                                # PubMed Central full-text fetcher
│   ├── (nutrition)/                              # Nutrition RAG pipeline
│   │   ├── orchestrator.ts                       # Pipeline entry point
│   │   ├── guard.ts                              # Topic relevance classifier
│   │   ├── llm.ts                                # LLM prompts + streaming; outputs follow-up suggestions
│   │   └── search.ts                             # Nutrition-scoped vector search
│   ├── (research)/                               # Biomedical research RAG pipeline
│   │   ├── orchestrator.ts                       # Pipeline entry point
│   │   ├── guard.ts                              # Biomedical topic classifier
│   │   └── llm.ts                                # LLM prompts + streaming; outputs follow-up suggestions
│   ├── reranker.ts                               # Shared cross-encoder reranker with diversity enforcement
│   ├── auth-client.ts
│   ├── auth.ts                                   # better-auth server config
│   └── utils.ts
├── providers/
│   └── theme-provider.tsx
├── src/db/
│   ├── index.ts                                  # Drizzle client
│   └── schemas/
│       ├── auth-schema.ts                        # better-auth tables
│       └── schema.ts                             # App tables (conversations, messages, papers, message_feedback, recipes)
├── scripts/
│   └── seed-recipes.ts                           # Fetch 10 healthy recipes per category from Spoonacular
├── public/
│   └── open-graph.png
├── drizzle.config.ts
└── next.config.ts
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- PostgreSQL with the `pgvector` extension (e.g. Supabase)
- [Ollama](https://ollama.ai) running locally
- NCBI API key (free at [ncbi.nlm.nih.gov](https://www.ncbi.nlm.nih.gov/account/))
- HuggingFace API key (free at [huggingface.co](https://huggingface.co/settings/tokens))

### Install

```bash
bun install
```

### Environment variables

Create a `.env` file:

```env
# App
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=

# Supabase / PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
DATABASE_URL=

# NCBI PubMed
NCBI_API_KEY=

# HuggingFace (embeddings)
HUGGING_FACE_API_KEY=

# Ollama (LLM)
OLLAMA_API_KEY=

# Spoonacular (recipes)
SPOONACULAR_API_KEY=
```

### Database

```bash
bunx drizzle-kit push
```

### Seed recipes

```bash
bun scripts/seed-recipes.ts
```

### Run

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Attribution

- Favicon - [Nutritionist icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/nutritionist)

## License

MIT
