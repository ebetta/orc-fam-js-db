# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & commands

Single-package Vite + React 18 SPA (JavaScript, one TS helper at `src/utils/index.ts`).

```bash
npm install

npm run dev        # Vite dev server only
npm run server      # local Express API only (port 3001)
npm run dev:all     # both, via concurrently
npm run build
npm run lint
npm run preview
```

There is no test runner or typecheck script.

## Backend: local Express + PostgreSQL

- `src/lib/api.js` is the active backend: talks to a local Express server (`http://localhost:3001/api`), uses mock auth via `localStorage`.
- The app previously supported Supabase; that client was removed since it was unused (dependency `@supabase/supabase-js` was never even installed). The app runs fully local, with no required env vars — Postgres connection settings live at the top of `server.js`.

### Local Express server (`server.js`)

- Requires local PostgreSQL with database `orc-fam` on port 5432 (credentials at the top of `server.js`).
- Generic CRUD at `/api/{accounts,budgets,tags,transactions}`, filtered by `user_id`.
- `/api/exchange_rates` is a global table (no `user_id` filter), with its own GET/POST/PUT/DELETE handlers.
- `/api/patrimony` (GET) and `/api/patrimony/rebuild` (POST) for net-worth history.
- Query params on GET: `_sort` (field or comma-separated list), `_order` (`asc`/`desc`), `_limit`.
- Response shape: `{ data: rows, error: null }` on success, `{ data: null, error: { message } }` on failure (4xx/5xx).
- Mock auth: `POST /api/auth/login` returns a hardcoded user + session; `GET /api/auth/user`. `MOCK_USER_ID = '11111111-1111-1111-1111-111111111111'`. The frontend session lives in `localStorage` (`local_session`, `local_user`) — see `src/lib/api.js`'s `auth` export. Login is a single-button page (`Entrar (Modo Local)`).
- `migration.sql` has one-time SQL to drop `auth.users` FK constraints and reassign `user_id` to the mock UUID.
- A trigger (`update_account_balances_from_transaction`) recalculates `accounts.current_balance` whenever transactions are inserted/updated/deleted — don't recompute balances manually in app code.

Full table schemas (accounts, tags, budgets, transactions, exchange_rates) are documented in [GEMINI.md](GEMINI.md) — read that before writing raw SQL or migrations.

## App architecture

- Entry chain: `src/main.jsx` → `src/App.jsx` → `src/pages/index.jsx` (react-router-dom v7).
- `/login` is the only **public** route (no sidebar/layout, rendered outside `Layout`). All other routes (`/Dashboard`, `/Accounts`, `/Tags`, `/TransactionsV2`, `/Budgets`, `/Reports`, `/Import`) are wrapped in `ProtectedRoute` (checks `auth.getSession()`) + `Layout`.
- Route URLs are built with `createPageUrl()` in `src/utils/index.ts` (lowercase, spaces → hyphens) — always use this rather than hand-building paths.
- **When adding or renaming a page, update all three places:**
  1. `src/pages/index.jsx` — import, `PAGES` object, and `<Route path="...">`
  2. `src/pages/Layout.jsx` — `navigationItems` array (PT-BR title, icon, colors)
  3. The page component itself in `src/pages/` (page-level) or `src/components/<feature>/` (feature widgets)
- Route `path`s in `index.jsx` use PascalCase (e.g. `/Dashboard`, `/TransactionsV2`) — keep new routes consistent with `PAGES`.
- Feature components are grouped by domain under `src/components/` (`accounts/`, `budgets/`, `dashboard/`, `imports/`, `reports/`, `tags/`, `transactions/`), with generic shadcn primitives in `src/components/ui/`.

## UI conventions

- **shadcn/ui** (new-york style), config in `components.json`. Aliases: `@/components/ui`, `@/lib/utils` (`cn()` helper), `@/hooks`. `@/` resolves to `src/` (`vite.config.js`, `jsconfig.json` — note `jsconfig.json` only includes `src/**/*.js` and `src/**/*.jsx`, not `.ts`).
- Tailwind CSS v3 + `tailwindcss-animate`; no Prettier config.
- CSS variables in `src/index.css` (shadcn theme variables + sidebar variables).
- **Portuguese UI** — all sidebar labels, page titles, and user-facing text are in Brazilian Portuguese (this is a financial control app for Brazilian families). Never introduce English user-facing strings.
- **Visual style:** Corporate Modern / "Quiet Premium" per [DESIGN.md](DESIGN.md) and [GEMINI.md](GEMINI.md). Use Inter, soft shadows (4–6% opacity), rounded cards (`rounded-lg`/`rounded-xl`), light hover elevation. Do **not** use classic Material Design or paper textures/heavy shadows.
- Palette (Modern Wealth): Emerald primary/profits (`#10B981`), Indigo secondary/transactions-nav (`#6366F1`), Amber tertiary/budgets (`#F97316`), cool Slate neutrals (`#F8FAFC` background, `#E2E8F0` borders).
- Financial values: Inter font, `font-medium`/`font-semibold` weight for emphasis.
- Icons: `lucide-react`. Motion: `framer-motion`, used sparingly. Forms: `react-hook-form` + `zod`.

## Cursor rules

Scoped agent rules also live in `.cursor/rules/` and mirror the guidance above:
- `ui-design.mdc` — always applies (PT-BR UI + visual style)
- `pages-routing.mdc` — when editing `src/pages/**`
- `server-api.mdc` — when editing `server.js`
