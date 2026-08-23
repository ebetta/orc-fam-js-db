-- Integração Pluggy (Open Finance)
-- Aplicar manualmente:  psql -d orc-fam -f migrations/002_pluggy.sql

-- Identificador externo da transação (ex.: 'pluggy:<uuid>').
-- O índice único parcial é o que permite deduplicar com ON CONFLICT DO NOTHING.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id
  ON public.transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;

-- Mapeamento conta local <-> conta do Pluggy.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pluggy_account_id text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pluggy_last_sync_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_pluggy_account_id
  ON public.accounts (pluggy_account_id)
  WHERE pluggy_account_id IS NOT NULL;
