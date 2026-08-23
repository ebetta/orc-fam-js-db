-- 1) Data de corte por conta: a sincronização nunca importa nada anterior a ela,
--    preservando o histórico lançado à mão.
-- 2) Transações pendentes (fatura aberta) NÃO entram no saldo da conta.
-- Aplicar manualmente:  psql -d orc-fam -f migrations/004_pluggy_cutover_and_pending_balance.sql

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pluggy_cutover_date date;

CREATE OR REPLACE FUNCTION public.update_account_balances_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    IF OLD.is_pending THEN
      RETURN OLD;
    END IF;
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

  -- Handle INSERT
  ELSIF (TG_OP = 'INSERT') THEN
    IF NEW.is_pending THEN
      RETURN NEW;
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

  -- Handle UPDATE
  -- Reverter OLD e aplicar NEW só quando não-pendentes cobre também as transições
  -- pendente -> consolidada (entra no saldo) e consolidada -> pendente (sai).
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NOT OLD.is_pending THEN
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
    END IF;

    IF NOT NEW.is_pending THEN
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
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- O gatilho de UPDATE só dispara para as colunas listadas. Sem is_pending nessa
-- lista, consolidar uma pendente (PENDING -> POSTED) não entraria no saldo.
DROP TRIGGER IF EXISTS transactions_after_update_update_balance ON public.transactions;
CREATE TRIGGER transactions_after_update_update_balance
  AFTER UPDATE OF amount, transaction_type, account_id, destination_account_id, is_pending
  ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balances_from_transaction();
