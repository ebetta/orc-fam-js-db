# Orçamento Familiar — Repo Guide

## Stack & commands
- **Single-package Vite + React 18 SPA** (JavaScript, one TS helper at `src/utils/index.ts`)
- Commands:
  - `npm run dev:all` — runs both Vite dev server + local Express API via `concurrently`
  - `npm run dev` — Vite dev server only
  - `npm run server` — local Express API only (port 3001)
  - `npm run build` / `npm run lint` / `npm run preview`
- **No test runner** or typecheck script.

## Backend: dual setup, local one is active
- `src/lib/api.js` is the active backend: talks to a local Express server (`http://localhost:3001/api`), uses mock auth via `localStorage`.
- `src/lib/supabaseClient.js` creates a Supabase client but is **not imported** by the active API layer — the app runs fully local today.
- `.env` requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (needed if `supabaseClient.js` is ever used); `.env` is gitignored, no `.env.example`.

### Local Express server (`server.js`)
- Requires local PostgreSQL with database `orc-fam` on port 5432 (credentials in `server.js`).
- CRUD at `/api/{accounts,budgets,tags,transactions}` + `/api/exchange_rates` (global table).
- Query params: `_sort` (field or comma-separated), `_order` (`asc`/`desc`), `_limit`.
- Mock auth: `POST /api/auth/login` returns a hardcoded user + `localStorage`-based session. Login is a single-button page (`Entrar (Modo Local)`).
- `migration.sql` has one-time SQL to drop `auth.users` FK constraints and reassign `user_id` to the mock UUID (`11111111-...`).

## App architecture
- Entry: `src/main.jsx` → `src/App.jsx` → `src/pages/index.jsx` (react-router-dom v7).
- `/login` is the only **public** route (no sidebar/layout). All other routes (`/Dashboard`, `/Accounts`, `/Tags`, `/Transactions`, `/Budgets`, `/Reports`, `/Import`) are wrapped in `ProtectedRoute` + `Layout`.
- Route URLs use `createPageUrl()` in `src/utils/index.ts`: lowercase, spaces → hyphens.
- When adding/renaming pages, update both `src/pages/index.jsx` routes and `src/pages/Layout.jsx` navigation.

## UI conventions
- **shadcn/ui** (new-york style), config in `components.json`. Aliases: `@/components/ui`, `@/lib/utils` (`cn()` helper), `@/hooks`.
- Tailwind CSS v3 + `tailwindcss-animate`; no Prettier config.
- CSS variables in `src/index.css` (shadcn theme variables + sidebar variables).
- `@/` resolves to `src/` (`vite.config.js`, `jsconfig.json`). Note: `jsconfig.json` only includes `src/**/*.js` and `src/**/*.jsx` (not `.ts`).
- **Portuguese UI** — all sidebar labels, page titles, and user-facing text are in Portuguese (financial control app for Brazilian families).
- **Style guide in `GEMINI.md`**: Material Design principles, paper-texture cards, vibrant colors, elevation shadows for hierarchy, responsive animations — follow for any new components/pages.
- Icons: `lucide-react`. Motion: `framer-motion`. Forms: `react-hook-form` + `zod`.

