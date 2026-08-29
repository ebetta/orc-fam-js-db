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
- `/api/pluggy/*` — Open Finance integration (see below).
- Query params on GET: `_sort` (field or comma-separated list), `_order` (`asc`/`desc`), `_limit`.
- Response shape: `{ data: rows, error: null }` on success, `{ data: null, error: { message } }` on failure (4xx/5xx).
- Mock auth: `POST /api/auth/login` returns a hardcoded user + session; `GET /api/auth/user`. `MOCK_USER_ID = '11111111-1111-1111-1111-111111111111'`. The frontend session lives in `localStorage` (`local_session`, `local_user`) — see `src/lib/api.js`'s `auth` export. Login is a single-button page (`Entrar (Modo Local)`).
- `migration.sql` has one-time SQL to drop `auth.users` FK constraints and reassign `user_id` to the mock UUID. Later migrations live in `migrations/` and are applied by hand (`psql -d orc-fam -f migrations/002_pluggy.sql`) — there is no migration runner.
- A trigger (`update_account_balances_from_transaction`) recalculates `accounts.current_balance` whenever transactions are inserted/updated/deleted — don't recompute balances manually in app code.

Full table schemas (accounts, tags, budgets, transactions, exchange_rates) are documented in [GEMINI.md](GEMINI.md) — read that before writing raw SQL or migrations.

### Pluggy / Open Finance (`pluggy.js` + `/api/pluggy/*`)

- `pluggy.js` is the API client for [Pluggy](https://docs.pluggy.ai) (`https://api.pluggy.ai`): `POST /auth` exchanges `clientId`/`clientSecret` for an `apiKey` valid for 2h (cached in memory, sent as `X-API-KEY`), then `GET /items/{id}`, `GET /accounts?itemId=`, and `GET /v2/transactions` with cursor pagination. **Credentials are server-side only** — never expose them to the frontend.
- Personal-use path: the **Conector 200 (Meu Pluggy)** proxies the banks already linked at meu.pluggy.ai and is free indefinitely for your own accounts — the Dashboard's 15-day trial only gates commercial use (connecting other people's accounts).
- Config lives in `.env` (loaded via `import 'dotenv/config'` at the top of `server.js`): `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEM_IDS` (comma-separated; there is no `GET /items` endpoint, so item ids must be configured by hand). All optional — without them `/api/pluggy/status` reports `configured: false` and the UI shows setup instructions. `PORT` also overrides the default 3001.
- Routes: `GET /api/pluggy/status`, `GET /api/pluggy/accounts` (remote accounts joined with the local mapping, plus `local_balance`/`difference`), `POST /api/pluggy/sync`, `POST /api/pluggy/reconcile`, `POST /api/pluggy/items/:id/update` (Pluggy rate-limits this to once per hour).
- **Balance drift is structural, not a bug.** Pluggy keeps 12 months and `pluggy_cutover_date` deliberately excludes hand-entered history, so the local ledger can never reconstruct the balance on its own — and a credit card's invoice cycle keeps moving underneath it. `POST /api/pluggy/reconcile` posts one adjustment transaction (`external_id` NULL, so no sync ever deletes it) that aligns `current_balance` to Pluggy's. For a `CREDIT` account the target is `-balance`, since Pluggy reports the amount owed as positive.
- **Reconcile only after a sync.** Pluggy's account balance and its transaction list can disagree inside the same snapshot (observed: a purchase counted in `balance` before it appeared in `/v2/transactions`). Reconciling during that window posts an adjustment that double-counts once the transaction lands. The UI warns about this next to the button.
- Sync mapping: `external_id = 'pluggy:<tx.id>'` deduplicates via `INSERT ... ON CONFLICT DO NOTHING` on the partial unique index; `DEBIT → expense`, `CREDIT → income` (never `transfer`). `recalculateMonthlyPatrimony()` runs **once at the end**, not per row.
- **Pending transactions** (`transactions.is_pending`): on a credit card, everything on the open invoice comes back as `PENDING`, and Pluggy warns such rows may change value, description, or even id (it deletes and recreates them). So each sync **deletes the pending rows it previously wrote in the window and rewrites them**, carrying over any `tag_id` you set by hand. They **do** count toward balances like any other transaction (`migrations/005` reverted the earlier rule that excluded them; `004` is kept for history). Note `AFTER UPDATE OF ...` on the balance trigger lists specific columns — anything that must move the balance has to be in that list.
- **Freshness ceiling:** items on the **Conector 200 (MeuPluggy)** collect from the bank on their own, roughly once a day (`item.nextAutoSyncAt`), and reject `PATCH /items` with "MeuPluggy item cant be updated". A purchase made after the last collection cannot be synced no matter how often you press the button — `/api/pluggy/status` exposes `nextAutoSyncAt` and `canForceUpdate` so the UI can say so.
- `accounts.pluggy_account_id` maps a local account to a Pluggy account; `accounts.pluggy_last_sync_at` drives the incremental window (last sync − 7 days, or the last 90 days on first run); `accounts.pluggy_cutover_date` clamps that window so nothing older is ever imported. **The UI sets the cutover to today when you first map an account** — without it the first sync would pull 90 days and duplicate hand-entered history, since dedup only recognizes rows this integration wrote.
- Balances in this app are *derived* (`current_balance` = opening balance + transactions) while Pluggy only keeps **12 months** of history, so importing any slice leaves the balance short by everything before it. Adopting a new account therefore needs a one-time balance reconciliation, or a cutover date (the default).
- Auto-categorization lives in `src/lib/tagMatcher.js` — a plain ESM module (no React, no `@/` alias) imported by both the browser and `server.js`.

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
