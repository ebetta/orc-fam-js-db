-- Transações de fatura aberta / parcelas futuras chegam do Pluggy como PENDING.
-- Elas podem mudar de valor, descrição ou até de id até serem consolidadas, então
-- a sincronização apaga e regrava as pendentes da janela a cada execução.
-- Aplicar manualmente:  psql -d orc-fam -f migrations/003_pluggy_pending.sql

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_pending boolean NOT NULL DEFAULT false;

-- Usado pela limpeza por conta + janela de datas a cada sincronização.
CREATE INDEX IF NOT EXISTS idx_transactions_pending_sync
  ON public.transactions (account_id, transaction_date)
  WHERE is_pending;
