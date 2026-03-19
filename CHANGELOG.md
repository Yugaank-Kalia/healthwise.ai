# Changelog

All notable changes to healthwise.ai are documented here.

## [Unreleased]

**Healthy recipes** - recipe suggestions grounded in NIH nutritional research

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
