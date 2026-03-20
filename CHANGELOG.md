# Changelog

## [Unreleased]

- **Healthy recipes** - recipe suggestions grounded in NIH nutritional research

## [1.2.0] - 2026-03-19

### Streaming & Real-time Feedback

- **Token-by-token streaming** - responses stream via SSE instead of polling the DB every 2 seconds. Users start reading within 2 seconds instead of staring at a blank screen for 15-30s while the full answer generates.
- **Pipeline progress states** - "Thinking…" and "Indexing papers…" loading states replace a generic spinner. On cache-miss queries that take 5-15s to fetch from PubMed, users now understand _why_ it's taking longer rather than assuming it's broken.
- **Mid-stream reload resilience** - refreshing the page mid-stream no longer loses the response. Users who accidentally reload or experience a brief connection drop still get their complete answer.

### Citations & Sources

- **Inline PMID badges** - `[PMID:XXXXXXXX]` citations rendered as numbered badges with hover cards showing paper title, authors, and a direct PubMed link. Users can verify any claim in one click without leaving the conversation.
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
