# Orçamento Familiar — Repo Guide

## Stack & commands
- **Single-package Vite + React 18 SPA** (JavaScript, one TS helper at `src/utils/index.ts`)
- Commands:
  - `npm run dev:all` — runs both Vite dev server + local Express API via `concurrently`
  - `npm run dev` — Vite dev server only
  - `npm run server` — local Express API only (port 3001)
  - `npm run build` / `npm run lint` / `npm run preview`
- **No test runner** or typecheck script.

## Backend: local Express + PostgreSQL
- `src/lib/api.js` is the active backend: talks to a local Express server (`http://localhost:3001/api`), uses mock auth via `localStorage`.
- The app previously supported Supabase; that client was removed since it was unused. The app runs fully local, with no required env vars — Postgres connection settings live at the top of `server.js`.

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
- **Visual style:** Corporate Modern / "Quiet Premium" per `DESIGN.md` and `GEMINI.md`. Use Inter, soft shadows (4–6% opacity), rounded cards (`rounded-lg`/`rounded-xl`). **Do not** use classic Material Design or paper textures.
- Palette: Emerald primary (`#10B981`), Indigo secondary (`#6366F1`), Amber tertiary (`#F97316`), Slate neutrals.
- Icons: `lucide-react`. Motion: `framer-motion`. Forms: `react-hook-form` + `zod`.

## Cursor rules
Scoped agent rules live in `.cursor/rules/`:
- `ui-design.mdc` — always applies (PT-BR UI + visual style)
- `pages-routing.mdc` — when editing `src/pages/**`
- `server-api.mdc` — when editing `server.js`

