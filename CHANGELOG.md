# Changelog

All notable changes to healthwise.ai are documented here.

## [Unreleased]

**Healthy recipes** - recipe suggestions grounded in NIH nutritional research

## [1.2.0] - 2026-03-19

### Added

- **Token-by-token streaming** - assistant responses stream word-by-word via SSE, matching ChatGPT-style UX; the LLM pipeline runs inside the SSE handler so progress events can fire mid-pipeline
- **"Thinking…" animated dots** - assistant bubble shows a bouncing-dot animation while the RAG pipeline runs before the first token arrives
- **"Indexing papers…" state** - distinct loading label appears when the pipeline is fetching and ingesting new PubMed papers for a cache-miss query
- **Inline PMID citations** - `[PMID: XXXXXXXX]` and `(PMID: XXXXXXXX)` rendered as `(index)` plain-text links mapped to the message's source list; both bracket and parenthesis variants handled
- **Sources badge** - shows after streaming completes; displays up to 3 avatar circles and a count that opens the sources drawer
- **Copy button** - appears on hover at the bottom of both user and assistant bubbles; shows a check icon for 2 seconds after copying
- **Staff of Asclepius icon** - inline SVG replaces the ⚕️ emoji in the LLM's disclaimer line
- **Hardcoded disclaimer** - "Healthwise is AI and can make mistakes. Please double-check responses." appended below every completed assistant reply
- **Profile page** - display name editing and password change (react-hook-form + Zod validation), Google OAuth users see a managed-by-Google notice; account deletion with confirmation input
- **`/api/user` endpoint** - returns `hasPassword` flag used by the profile page to conditionally show the password form

### Fixed

- **Mid-stream reload resilience** - messages with `status: streaming` are now polled on reload (previously only `pending` was polled), so interrupted streams resolve to their final state once the server finishes
- **Server-side disconnect safety** - `send()` in the SSE route wraps `controller.enqueue()` in a try/catch; if the client disconnects, the server continues streaming to completion and the DB is always finalized to `done` or `error`
- **Auto-scroll** - page scrolls instantly to the bottom on load (first visit), then smoothly on each new message or streaming token

## [1.1.0] - 2025-03-18

### Added

- **Mobile-friendly UI** - full responsive pass across all pages and components
    - Landing page (`app/page.tsx`): responsive typography (`text-4xl` → `text-6xl`), full-width CTA buttons on mobile, reduced padding on small screens
    - Dashboard layout: sidebar hidden on mobile (`hidden sm:flex`); conversations accessible via a ⋮ dropdown in the navbar
    - Navbar: `MobileConversationsMenu` component added - vertical dots button (mobile only) opens a dropdown with New Chat and full conversation list, keeping a single top navigation bar across all screen sizes
    - Chat input: "Press Enter to send" hint hidden on mobile; amber first-query notice scaled down to `text-[10px]` on mobile
    - Conversation 3-dot menu: always visible on mobile (was hover-only on desktop)
    - Footer text: `text-xs sm:text-sm` responsive sizing

## [1.0.0] - 2025-03-17

### Added

- Initial release
- Just-in-time RAG pipeline - PubMed papers fetched, chunked, embedded, and stored on first query for any topic
- Persistent conversations and messages per user, with status tracking (`pending` / `done` / `error`)
- Page-reload resilience - pending LLM responses resume polling on reload; server completes processing regardless of client connection
- Sources drawer - right-side drawer showing cited NIH papers with title, authors, year, and PubMed link
- Inline citation rendering - `[PMID: XXXXXXXX]` rendered as PubMed hyperlinks; `**bold**` and `*italic*` rendered as bold text
- Conversation management - rename and delete via 3-dot menu; auto-naming from first query
- Scroll-to-bottom button - appears when scrolled away from latest message
- Google OAuth authentication via better-auth
- Dark mode support
