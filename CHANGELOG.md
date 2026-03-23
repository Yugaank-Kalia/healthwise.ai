# Changelog

## [Unreleased]

- **Biomedical research** _(coming soon)_ - a dedicated research mode letting users go beyond nutrition into broader biomedical topics: pharmacology, disease mechanisms, clinical trials, and more, all grounded in NIH/PubMed literature.

### Added

- **Biomedical research mode** - `/research` runs its own RAG pipeline with a separate LLM prompt tuned for biomedical evidence levels (Strong/Moderate/Limited), clinical trial phases, and animal vs. human study distinctions. Shares the same `nih_papers`/`nih_chunks` tables as the nutrition pipeline; analytics tracked separately in `research_search_queries`.
- **Follow-up suggestions** - after every completed response in both nutrition and research modes, the LLM generates 3 contextual follow-up questions rendered as clickable chips below the bubble. Clicking a chip pre-fills the input. Nutrition suggestions are framed for everyday health decisions; research suggestions target deeper scientific angles.
- **Export to PDF** - a download button in the input bar lets users export any conversation as a formatted PDF. Generated entirely client-side via `html2pdf.js` (dynamic import to avoid SSR issues). The PDF includes all Q&A pairs with bold headings, superscript citation numbers, a full source list with PubMed links, and a disclaimer footer. Works for both nutrition (`/dashboard`) and research (`/research`) conversations.
- **Recipes page** - browse healthy recipes across Meat, Vegan, and Vegetarian categories, populated from the Spoonacular API. Three-card preview per category with inline "Show all" expansion and 6-per-page pagination.
- **Recipe detail page** - full recipe at `/recipes/[slug]` with header image, prep time, calories, numbered ingredients list, and step-by-step instructions.
- **Spoonacular seed script** - `scripts/seed-recipes.ts` fetches 10 healthy recipes per category (sorted by healthiness score) and upserts them into the `recipes` table.
- **Slug-based recipe IDs** - recipe IDs are derived from the title (e.g. `red-lentil-tofu-pasta`) instead of UUIDs, making URLs human-readable and SEO friendly.
- **Navbar** - links to Dashboard, Research, and Recipes; shows the two destinations you're not currently on.

### Changed

- `recipes.id` changed from UUID to text slug (requires DB table drop and `drizzle-kit push` to migrate).
- `recipes.instructions` changed from `text` to `text[]` to store steps as a proper array.
- Category enum values lowercased to `vegan`, `meat`, `vegetarian`.

## [1.3.0] - 2026-03-21

### Response Quality Feedback

- **Thumbs up / thumbs down on assistant messages** - users can rate any completed response directly from the chat bubble. The primary motivation is measurement: as the retrieval and reranking pipeline evolves, we needed a lightweight ground-truth signal to know whether changes are actually producing better answers - not just faster or different ones. Ratings are stored in a new `message_feedback` table (keyed by message and user) and can be queried at any time (`select value, count(*) from message_feedback group by value`). One vote per user per message; clicking the same thumb again toggles it off. Feedback persists across page reloads.

### Retrieval Improvements

- **Cross-encoder reranker** - the previous pipeline ranked chunks by cosine similarity alone, which allowed two highly-similar papers to occupy all 6 context slots. The new pipeline fetches 20 candidates at a lower threshold, rescores each query-chunk pair with `BAAI/bge-reranker-base` (a cross-encoder that reads query and document together for a far more accurate relevance score), then applies diversity enforcement: the top chunk from at least 4 unique papers is guaranteed before remaining slots are filled by score. In practice this surfaces more varied evidence and reduces single-paper dominance.

### Bug Fixes

- **Stale conversation data after deletion** - deleting a conversation from the sidebar now immediately clears the chat view. Previously, `router.replace` served a cached page render, leaving the old messages visible until a manual reload.
- **404 for invalid conversation URLs** - navigating to `/dashboard/<non-uuid>` now returns a proper 404 page instead of crashing with a Postgres type error. Valid UUIDs for deleted conversations are also caught and redirect correctly.
- **PMID citation parsing** - bare (`PMID:28991769`) and curly-bracket (`{PMID:28991769}`) citation formats are now parsed and rendered the same as the standard `[PMID:...]` format. The LLM occasionally omits brackets despite the system prompt; this makes the UI robust to that.

## [1.2.0] - 2026-03-19

### Streaming & Real-time Feedback

- **Token-by-token streaming** - responses stream via SSE instead of polling the DB every 2 seconds. Users start reading within 2 seconds instead of staring at a blank screen for 15-30s while the full answer generates.
- **Pipeline progress states** - "Thinking…" and "Indexing papers…" loading states replace a generic spinner. On cache-miss queries that take 5-15s to fetch from PubMed, users now understand _why_ it's taking longer rather than assuming it's broken.
- **Mid-stream reload resilience** - refreshing the page mid-stream no longer loses the response. Users who accidentally reload or experience a brief connection drop still get their complete answer.

### Citations & Sources

- **Inline PMID badges** - `PMID:XXXXXXXX` citations rendered as numbered badges with hover cards showing paper title, authors, and a direct PubMed link. Users can verify any claim in one click without leaving the conversation.
- **Sources drawer** - a panel listing all cited papers with full metadata. Gives users a clear picture of what research informed the answer and lets them explore further.

### Account Management

- **Profile page** - display name editing, password change, and account deletion. Users have full control over their data and account without needing to contact support.

## [1.1.0] - 2025-03-18

### Mobile

- **Responsive UI** - sidebar replaced with a dropdown menu on mobile, input hints hidden on small screens. Users can ask nutrition questions on their phone with the same experience as desktop.

## [1.0.0] - 2025-03-17

### Initial Release

- **Just-in-time RAG pipeline** - PubMed papers fetched, chunked via PubMedBERT embeddings, and stored in Supabase pgvector on first query. Users get answers grounded in real NIH research without the app needing to pre-index millions of papers.
- **Conversations** - persistent chat history with rename, delete, and auto-naming. Users can revisit past research questions and pick up where they left off.
- **Google OAuth** - one-click sign in without creating yet another password.
- **Dark mode** - reduced eye strain for users researching at night.
