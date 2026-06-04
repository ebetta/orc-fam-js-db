# Orçamento Familiar — Guia de Desenvolvimento & Padrões

Este arquivo serve como referência de diretrizes de design e estrutura do banco de dados para desenvolvimento do projeto por agentes de IA.

## 🎨 Diretrizes de Design (UI/UX)
O design do sistema segue rigorosamente o que está definido no arquivo [DESIGN.md](file:///home/eduardo/home/js/orc-fam-js-db/DESIGN.md).
- **Estilo Visual:** Corporate Modern com influências Minimalistas ("Quiet Premium"). Evite estilos antigos baseados em Material Design clássico ou texturas de papel.
- **Paleta de Cores (Modern Wealth):**
  - **Primary (Lucros/Saldos Positivos):** Emerald/Esmeralda (`#10B981`)
  - **Secondary (Transações/Navegação):** Indigo/Índigo (`#6366F1`)
  - **Tertiary (Orçamentos/Limites):** Amber/Laranja (`#F97316`)
  - **Neutros/Superfícies:** Tons frios de Slate (como `#F8FAFC` para o fundo e `#E2E8F0` para bordas).
- **Tipografia:** Uso exclusivo da fonte **Inter**. Valores numéricos financeiros devem usar pesos `Medium (500)` ou `SemiBold (600)` para destaque.
- **Formas e Bordas:**
  - Elementos padrão (botões, inputs): `rounded` (8px / `0.5rem`).
  - Cartões e widgets do dashboard: `rounded-lg` / `rounded-xl` (16px a 24px).
- **Sombras:** Sombras muito suaves e difusas (opacidade de 4% a 6%). No hover, aplicar um leve deslocamento (efeito de elevação).
- **Componentes:** Use sempre os componentes do **shadcn/ui** configurados no projeto e estilizados conforme as regras do [DESIGN.md](file:///home/eduardo/home/js/orc-fam-js-db/DESIGN.md).

---

## 🗄️ Estrutura de Banco de Dados (PostgreSQL Local)
O projeto utiliza um banco de dados **PostgreSQL local** rodando na porta `5432` com o nome `orc-fam` (as credenciais de acesso padrão estão configuradas no arquivo [server.js](file:///home/eduardo/home/js/orc-fam-js-db/server.js)).

> [!NOTE]
> Anteriormente, a aplicação utilizava Supabase. Agora, a API local Express simula o ambiente. No banco local, as constraints de chave estrangeira (`FK`) com a tabela `auth.users` foram removidas (conforme [migration.sql](file:///home/eduardo/home/js/orc-fam-js-db/migration.sql)) e todos os registros usam o ID de usuário fictício `11111111-1111-1111-1111-111111111111` para fins de autenticação simulada local.

Abaixo está o esquema das tabelas existentes no banco local para referência de desenvolvimento (colunas, tipos e restrições):

### 1. Contas (`accounts`)
Tabela que gerencia as contas bancárias, cartões de crédito e investimentos dos usuários.
```sql
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL, -- UUID do usuário simulado local ('11111111-...')
  name text NOT NULL,
  bank text NULL,
  account_number text NULL,
  account_type text NOT NULL, -- Valores permitidos: 'checking', 'savings', 'credit_card', 'investment', 'cash'
  initial_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL'::text, -- Valores permitidos: 'BRL', 'USD', 'EUR'
  is_active boolean NULL DEFAULT true,
  is_sample_data boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  current_balance numeric NULL DEFAULT 0,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_account_type_check CHECK (
    account_type = ANY (ARRAY['checking'::text, 'savings'::text, 'credit_card'::text, 'investment'::text, 'cash'::text])
  ),
  CONSTRAINT accounts_currency_check CHECK (
    currency = ANY (ARRAY['BRL'::text, 'USD'::text, 'EUR'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
```

### 2. Categorias/Tags (`tags`)
Tabela para categorização de transações e orçamentos.
```sql
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NULL DEFAULT '#CCCCCC'::text,
  icon text NULL,
  tag_type text NOT NULL, -- Valores permitidos: 'expense', 'income', 'both'
  is_active boolean NULL DEFAULT true,
  is_sample_data boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  parent_tag_id uuid NULL,
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_parent_tag_id_fkey FOREIGN KEY (parent_tag_id) REFERENCES tags (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT tags_tag_type_check CHECK (
    tag_type = ANY (ARRAY['expense'::text, 'income'::text, 'both'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id ON public.tags(parent_tag_id);
```

### 3. Orçamentos (`budgets`)
Tabela para limites de gastos definidos por categorias e períodos.
```sql
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  period text NOT NULL, -- Valores permitidos: 'monthly', 'weekly', 'yearly'
  start_date date NULL,
  end_date date NULL,
  is_active boolean NULL DEFAULT true,
  is_sample_data boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  tag_id uuid NULL,
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE SET NULL,
  CONSTRAINT budgets_period_check CHECK (
    period = ANY (ARRAY['monthly'::text, 'weekly'::text, 'yearly'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_tag_id ON public.budgets(tag_id);
```

### 4. Transações (`transactions`)
Tabela com o histórico de entradas, saídas e transferências entre contas.
```sql
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  id_base44 text NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL, -- Valores permitidos: 'income', 'expense', 'transfer'
  transaction_date date NOT NULL,
  notes text NULL,
  is_sample_data boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  account_id uuid NULL,
  destination_account_id uuid NULL,
  tag_id uuid NULL,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
  CONSTRAINT transactions_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE SET NULL,
  CONSTRAINT transactions_transaction_type_check CHECK (
    transaction_type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_destination_account_id ON public.transactions(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tag_id ON public.transactions(tag_id);
```

### 5. Cotações de Câmbio (`exchange_rates`)
Tabela global de cotações compartilhadas entre todos os usuários do sistema.
```sql
CREATE TABLE public.exchange_rates (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  rate_date date NOT NULL,
  is_sample_data boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (id),
  CONSTRAINT exchange_rates_from_currency_to_currency_rate_date_key UNIQUE (from_currency, to_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_pair_date ON public.exchange_rates(from_currency, to_currency, rate_date);
```

### Triggers e Funções de Atualização
- **`handle_updated_at`**: Atualiza a coluna `updated_at` automaticamente nos updates de tabelas.
- **`update_account_balances_from_transaction`**: Trigger nas transações que recalcula o `current_balance` das contas envolvidas quando transações são inseridas, atualizadas ou removidas.
