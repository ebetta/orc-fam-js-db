-- Transferências entre contas de moedas diferentes: cada lado na moeda da sua conta.
-- amount              → valor debitado da conta de origem (moeda da origem)
-- destination_amount  → valor creditado na conta de destino (moeda do destino);
--                       NULL = igual a amount (mesma moeda ou lançamentos antigos).
--
-- Aplicar: psql -d orc-fam -f migrations/006_transfer_destination_amount.sql

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS destination_amount numeric NULL;

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
        UPDATE accounts SET current_balance = current_balance - COALESCE(OLD.destination_amount, OLD.amount)
         WHERE id = OLD.destination_account_id;
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
        UPDATE accounts SET current_balance = current_balance + COALESCE(NEW.destination_amount, NEW.amount)
         WHERE id = NEW.destination_account_id;
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
        UPDATE accounts SET current_balance = current_balance - COALESCE(OLD.destination_amount, OLD.amount)
         WHERE id = OLD.destination_account_id;
      END IF;
    END IF;
    IF NEW.transaction_type = 'income' THEN
      UPDATE accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.transaction_type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      IF NEW.destination_account_id IS NOT NULL THEN
        UPDATE accounts SET current_balance = current_balance + COALESCE(NEW.destination_amount, NEW.amount)
         WHERE id = NEW.destination_account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- destination_amount precisa estar na lista: alterá-lo move o saldo do destino.
DROP TRIGGER IF EXISTS transactions_after_update_update_balance ON public.transactions;
CREATE TRIGGER transactions_after_update_update_balance
  AFTER UPDATE OF amount, destination_amount, transaction_type, account_id, destination_account_id
  ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balances_from_transaction();
