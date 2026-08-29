-- Reverte a regra de 004: transações pendentes (fatura aberta) VOLTAM a contar no
-- saldo da conta, para que o saldo do cartão acompanhe a movimentação do mês.
-- A coluna is_pending continua existindo: ela é o que permite à sincronização
-- apagar e regravar as pendentes a cada execução.
--
-- ATENÇÃO: o backfill no final NÃO é idempotente — rodar duas vezes aplica o
-- efeito das pendentes duas vezes. Executar uma única vez.

CREATE OR REPLACE FUNCTION public.update_account_balances_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.transaction_type = 'income' THEN
      UPDATE accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.transaction_type = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.transaction_type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.destination_account_id IS NOT NULL THEN
        UPDATE accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.destination_account_id;
      END IF;
    END IF;
    RETURN OLD;

  ELSIF (TG_OP = 'INSERT') THEN
    IF NEW.transaction_type = 'income' THEN
      UPDATE accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      IF NEW.destination_account_id IS NOT NULL THEN
        UPDATE accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.destination_account_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.transaction_type = 'income' THEN
      UPDATE accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.transaction_type = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.transaction_type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.destination_account_id IS NOT NULL THEN
        UPDATE accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.destination_account_id;
      END IF;
    END IF;
    IF NEW.transaction_type = 'income' THEN
      UPDATE accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      IF NEW.destination_account_id IS NOT NULL THEN
        UPDATE accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.destination_account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- is_pending sai da lista de colunas: com a regra revertida, alterá-la não muda o saldo.
DROP TRIGGER IF EXISTS transactions_after_update_update_balance ON public.transactions;
CREATE TRIGGER transactions_after_update_update_balance
  AFTER UPDATE OF amount, transaction_type, account_id, destination_account_id
  ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balances_from_transaction();

-- Backfill: as pendentes já gravadas nunca entraram no saldo. Aplicar agora.
WITH efeitos AS (
  SELECT account_id AS conta,
         SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END) AS delta
    FROM transactions WHERE is_pending AND account_id IS NOT NULL
   GROUP BY account_id
  UNION ALL
  SELECT destination_account_id, SUM(amount)
    FROM transactions
   WHERE is_pending AND transaction_type = 'transfer' AND destination_account_id IS NOT NULL
   GROUP BY destination_account_id
), total AS (
  SELECT conta, SUM(delta) AS delta FROM efeitos GROUP BY conta
)
UPDATE accounts a SET current_balance = a.current_balance + t.delta
  FROM total t WHERE a.id = t.conta;
