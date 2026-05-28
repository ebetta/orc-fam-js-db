-- Script para migrar dados do Supabase para Postgres Local
-- Substitui os user_ids antigos do Firebase/Google por um UUID de teste local

-- 1. Inserir o usuário mock na tabela auth.users se for necessário (ou desabilitar a constraint)
-- OBS: Se as tabelas possuem foreign key para auth.users (como definido no esquema original),
-- precisamos ou criar o usuário mock no schema public (e alterar a FK) ou remover a FK do banco local.

-- No Postgres local que é apenas uma cópia, a tabela auth.users não existe por padrão,
-- ou se existir, precisamos inserir nosso MOCK UUID.
-- O ideal para um ambiente puramente local é remover a foreign key de auth.users, já que 
-- o auth.users pertence ao ambiente Supabase.

-- Remove as FKs de user_id que apontam para auth.users:
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_user_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- 2. Atualizar todos os registros para o novo UUID de mock
DO $$ 
DECLARE 
  mock_uuid UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  UPDATE public.accounts SET user_id = mock_uuid;
  UPDATE public.budgets SET user_id = mock_uuid;
  UPDATE public.tags SET user_id = mock_uuid;
  UPDATE public.transactions SET user_id = mock_uuid;
END $$;
