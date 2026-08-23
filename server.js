import 'dotenv/config';
import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import {
  isPluggyConfigured,
  getConfiguredItemIds,
  fetchItem,
  fetchAccounts,
  fetchTransactions,
  triggerItemUpdate
} from './pluggy.js';
import { findMatchingTag } from './src/lib/tagMatcher.js';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

// Configure PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  password: '238827',
  host: 'localhost',
  port: 5432,
  database: 'orc-fam',
});

// Mock user ID for local auth
const MOCK_USER_ID = '11111111-1111-1111-1111-111111111111';

// --- Patrimony Recalculation ---
async function recalculateMonthlyPatrimony() {
  try {
    const { rows: accounts } = await pool.query('SELECT * FROM accounts WHERE user_id = $1', [MOCK_USER_ID]);
    // Pendentes (fatura aberta) não entram no saldo, então também não podem ser
    // revertidas no cálculo histórico — ver migrations/004.
    const { rows: allTransactions } = await pool.query('SELECT * FROM transactions WHERE user_id = $1 AND NOT is_pending ORDER BY transaction_date DESC', [MOCK_USER_ID]);
    const { rows: exchangeRates } = await pool.query('SELECT * FROM exchange_rates');

    // Get latest rate for each currency pair
    const rateCache = {};
    for (const r of exchangeRates) {
      const key = `${r.from_currency}->${r.to_currency}`;
      if (!rateCache[key] || new Date(r.rate_date) > new Date(rateCache[key].rate_date)) {
        rateCache[key] = r;
      }
    }
    const getRate = (fromCurrency, toCurrency) => {
      if (fromCurrency === toCurrency) return 1;
      return parseFloat(rateCache[`${fromCurrency}->${toCurrency}`]?.rate) || 1;
    };
    const toBRL = (amount, currency) => amount * getRate(currency, 'BRL');

    // Collect all unique year-months from transactions + current month
    const monthSet = new Set();
    for (const t of allTransactions) {
      const d = typeof t.transaction_date === 'string' ? t.transaction_date : t.transaction_date.toISOString().split('T')[0];
      monthSet.add(d.substring(0, 7));
    }
    const now = new Date();
    monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const sortedMonths = [...monthSet].sort();

    // Clear existing snapshots for this user
    await pool.query('DELETE FROM monthly_patrimony WHERE user_id = $1', [MOCK_USER_ID]);

    // Calculate net worth for each month (backwards from present)
    for (let i = sortedMonths.length - 1; i >= 0; i--) {
      const yearMonth = sortedMonths[i];
      const [year, month] = yearMonth.split('-').map(Number);
      const monthEnd = new Date(year, month, 0);
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      let netWorthBRL = 0;

      for (const account of accounts) {
        if (account.is_active === false) continue;

        const currency = account.currency || 'BRL';
        let balance = parseFloat(account.current_balance);
        if (isNaN(balance)) balance = parseFloat(account.initial_balance) || 0;

        // Reverse transactions after this month's end
        const txAfter = allTransactions.filter(t => {
          const tDate = typeof t.transaction_date === 'string' ? t.transaction_date : t.transaction_date.toISOString().split('T')[0];
          return tDate > monthEndStr &&
            (t.account_id === account.id || t.destination_account_id === account.id);
        });

        for (const t of txAfter) {
          const amount = parseFloat(t.amount) || 0;

          if (t.account_id === account.id) {
            if (t.transaction_type === 'income') balance -= amount;
            else if (t.transaction_type === 'expense') balance += amount;
            else if (t.transaction_type === 'transfer') balance += amount;
          } else if (t.destination_account_id === account.id) {
            balance -= amount;
          }
        }

        const balanceBRL = toBRL(balance, currency);
        netWorthBRL += balanceBRL;
      }

      await pool.query(
        `INSERT INTO monthly_patrimony (user_id, year_month, net_worth_brl)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, year_month)
         DO UPDATE SET net_worth_brl = $3, updated_at = now()`,
        [MOCK_USER_ID, yearMonth, Math.round(netWorthBRL * 100) / 100]
      );
    }
  } catch (error) {
    console.error('Error recalculating monthly patrimony:', error);
  }
}

// --- Generic CRUD Controller ---
const handleGet = async (req, res, tableName) => {
  try {
    let query = `SELECT * FROM ${tableName} WHERE user_id = $1`;
    const params = [MOCK_USER_ID];

    // Sorting
    const sortBy = req.query._sort;
    const order = req.query._order === 'asc' ? 'ASC' : 'DESC';
    
    // Support multiple orderings comma separated, e.g. transaction_date,created_at
    if (sortBy) {
      const sortFields = sortBy.split(',').map(field => `${field} ${order}`).join(', ');
      query += ` ORDER BY ${sortFields}`;
    }

    // Limit
    const limit = req.query._limit;
    if (limit && !isNaN(limit)) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error(`Error GET ${tableName}:`, error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
};

const handlePost = async (req, res, tableName) => {
  try {
    // Auto-generate UUID for id (local PG lacks the uuid_generate_v4() default from Supabase)
    const data = { id: randomUUID(), ...req.body, user_id: MOCK_USER_ID };
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    const { rows } = await pool.query(query, values);
    if (tableName === 'transactions' || tableName === 'accounts') {
      recalculateMonthlyPatrimony().catch(err => console.error('Error recalculating patrimony:', err));
    }
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error(`Error POST ${tableName}:`, error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
};

const handlePut = async (req, res, tableName) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    // Prevent updating id or user_id
    delete data.id;
    delete data.user_id;

    const keys = Object.keys(data);
    const values = Object.values(data);
    
    if (keys.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' }, data: null });
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const query = `UPDATE ${tableName} SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`;
    
    const { rows } = await pool.query(query, [...values, id, MOCK_USER_ID]);
    if (tableName === 'transactions' || tableName === 'accounts') {
      recalculateMonthlyPatrimony().catch(err => console.error('Error recalculating patrimony:', err));
    }
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error(`Error PUT ${tableName}:`, error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
};

const handleDelete = async (req, res, tableName) => {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${tableName} WHERE id = $1 AND user_id = $2 RETURNING *`;
    const { rows } = await pool.query(query, [id, MOCK_USER_ID]);
    if (tableName === 'transactions' || tableName === 'accounts') {
      recalculateMonthlyPatrimony().catch(err => console.error('Error recalculating patrimony:', err));
    }
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error(`Error DELETE ${tableName}:`, error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
};

// --- Exchange Rates Routes (global table, no user_id) ---
app.get('/api/exchange_rates', async (req, res) => {
  try {
    let query = 'SELECT * FROM exchange_rates';
    const sortBy = req.query._sort;
    const order = req.query._order === 'asc' ? 'ASC' : 'DESC';
    if (sortBy) {
      const sortFields = sortBy.split(',').map(field => `${field} ${order}`).join(', ');
      query += ` ORDER BY ${sortFields}`;
    }
    const limit = req.query._limit;
    if (limit && !isNaN(limit)) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    const { rows } = await pool.query(query);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error('Error GET exchange_rates:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

app.post('/api/exchange_rates', async (req, res) => {
  try {
    const data = { id: randomUUID(), ...req.body };
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO exchange_rates (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const { rows } = await pool.query(query, values);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error('Error POST exchange_rates:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

app.put('/api/exchange_rates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    delete data.id;
    const keys = Object.keys(data);
    const values = Object.values(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' }, data: null });
    }
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const query = `UPDATE exchange_rates SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
    const { rows } = await pool.query(query, [...values, id]);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error('Error PUT exchange_rates:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

app.delete('/api/exchange_rates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM exchange_rates WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error('Error DELETE exchange_rates:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

// --- Patrimony Routes (pre-computed monthly snapshots) ---
app.get('/api/patrimony', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM monthly_patrimony WHERE user_id = $1 ORDER BY year_month ASC',
      [MOCK_USER_ID]
    );
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error('Error GET monthly_patrimony:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

app.post('/api/patrimony/rebuild', async (req, res) => {
  await recalculateMonthlyPatrimony();
  const { rows } = await pool.query(
    'SELECT * FROM monthly_patrimony WHERE user_id = $1 ORDER BY year_month ASC',
    [MOCK_USER_ID]
  );
  res.json({ data: rows, error: null });
});

// --- Pluggy Routes (Open Finance) ---
const PLUGGY_PREFIX = 'pluggy:';
const DEFAULT_SYNC_DAYS = 90;
// PENDING vira POSTED com id/valor diferentes; reprocessamos uma janela de folga.
const SYNC_OVERLAP_DAYS = 7;

function toDateOnly(value) {
  return new Date(value).toISOString().split('T')[0];
}

function daysAgo(days) {
  return toDateOnly(Date.now() - days * 24 * 60 * 60 * 1000);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Erro comum de configuração: colar a API Key (um JWT) no lugar do Item ID.
const INVALID_ITEM_ID_MESSAGE = 'Não é um Item ID válido (esperado um UUID). Copie o Item ID na Demo Application do dashboard.pluggy.ai — não use a API Key nem o Connect Token.';

// Status da conexão: quais items estão configurados e como estão no Pluggy.
app.get('/api/pluggy/status', async (req, res) => {
  const itemIds = getConfiguredItemIds();

  if (!isPluggyConfigured()) {
    return res.json({
      data: { configured: false, itemIds, items: [] },
      error: null
    });
  }

  try {
    const items = await Promise.all(itemIds.map(async (id) => {
      if (!UUID_RE.test(id)) {
        return { id, connectorName: null, status: 'INVALID', executionStatus: null, lastUpdatedAt: null, error: INVALID_ITEM_ID_MESSAGE };
      }
      try {
        const item = await fetchItem(id);
        return {
          id: item.id,
          connectorName: item.connector?.name || null,
          status: item.status,
          executionStatus: item.executionStatus,
          lastUpdatedAt: item.lastUpdatedAt,
          error: item.error?.message || null
        };
      } catch (error) {
        return { id, connectorName: null, status: 'ERROR', executionStatus: null, lastUpdatedAt: null, error: error.message };
      }
    }));

    res.json({ data: { configured: true, itemIds, items }, error: null });
  } catch (error) {
    console.error('Error GET pluggy/status:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

// Contas disponíveis no Pluggy, já cruzadas com o mapeamento local.
app.get('/api/pluggy/accounts', async (req, res) => {
  try {
    if (!isPluggyConfigured()) {
      return res.status(400).json({ error: { message: 'Pluggy não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env' }, data: null });
    }

    const itemIds = getConfiguredItemIds();
    const { rows: localAccounts } = await pool.query(
      'SELECT id, name, bank, account_type, pluggy_account_id, pluggy_last_sync_at, pluggy_cutover_date FROM accounts WHERE user_id = $1',
      [MOCK_USER_ID]
    );
    const byPluggyId = new Map(
      localAccounts.filter(a => a.pluggy_account_id).map(a => [a.pluggy_account_id, a])
    );

    const invalidIds = itemIds.filter(id => !UUID_RE.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: { message: `PLUGGY_ITEM_IDS inválido. ${INVALID_ITEM_ID_MESSAGE}` }, data: null });
    }

    const accounts = [];
    for (const itemId of itemIds) {
      const remoteAccounts = await fetchAccounts(itemId);
      for (const account of remoteAccounts) {
        const local = byPluggyId.get(account.id);
        accounts.push({
          id: account.id,
          item_id: itemId,
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          number: account.number,
          balance: account.balance,
          currency_code: account.currencyCode,
          local_account_id: local?.id || null,
          local_account_name: local?.name || null,
          last_sync_at: local?.pluggy_last_sync_at || null,
          cutover_date: local?.pluggy_cutover_date ? toDateOnly(local.pluggy_cutover_date) : null
        });
      }
    }

    res.json({ data: accounts, error: null });
  } catch (error) {
    console.error('Error GET pluggy/accounts:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

// Sincroniza transações do Pluggy para as contas locais mapeadas.
app.post('/api/pluggy/sync', async (req, res) => {
  try {
    if (!isPluggyConfigured()) {
      return res.status(400).json({ error: { message: 'Pluggy não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env' }, data: null });
    }

    const { accountId, from, to } = req.body || {};

    const params = [MOCK_USER_ID];
    let sql = 'SELECT id, name, pluggy_account_id, pluggy_last_sync_at, pluggy_cutover_date FROM accounts WHERE user_id = $1 AND pluggy_account_id IS NOT NULL';
    if (accountId) {
      params.push(accountId);
      sql += ' AND id = $2';
    }
    const { rows: accounts } = await pool.query(sql, params);

    if (accounts.length === 0) {
      return res.status(400).json({ error: { message: 'Nenhuma conta local está mapeada a uma conta do Pluggy.' }, data: null });
    }

    const { rows: tags } = await pool.query('SELECT id, name FROM tags WHERE user_id = $1', [MOCK_USER_ID]);

    const results = { total: 0, imported: 0, skipped: 0, errors: 0, pending: 0, details: [] };
    const endDate = to || toDateOnly(Date.now());

    for (const account of accounts) {
      const requestedStart = from
        || (account.pluggy_last_sync_at
          ? toDateOnly(new Date(account.pluggy_last_sync_at).getTime() - SYNC_OVERLAP_DAYS * 24 * 60 * 60 * 1000)
          : daysAgo(DEFAULT_SYNC_DAYS));

      // A data de corte protege o histórico lançado à mão: nada anterior a ela é importado.
      const cutover = account.pluggy_cutover_date ? toDateOnly(account.pluggy_cutover_date) : null;
      const startDate = cutover && cutover > requestedStart ? cutover : requestedStart;

      if (startDate > endDate) {
        results.details.push({
          status: 'skipped',
          description: `Conta ${account.name}`,
          amount: 0,
          date: startDate,
          reason: `Data de corte (${startDate}) posterior ao fim do período`
        });
        results.skipped++;
        continue;
      }

      let transactions;
      try {
        transactions = await fetchTransactions(account.pluggy_account_id, { from: startDate, to: endDate });
      } catch (error) {
        results.errors++;
        results.details.push({
          status: 'error',
          description: `Conta ${account.name}`,
          amount: 0,
          date: startDate,
          reason: error.message
        });
        continue;
      }

      // Pendentes (fatura aberta / parcelas futuras) mudam de valor, descrição e até
      // de id até consolidarem. Em vez de tentar casá-las, apagamos as que a própria
      // integração gravou na janela e regravamos o estado atual — o que também cobre
      // as que sumiram. As tags ajustadas à mão são preservadas por external_id.
      const { rows: previousPending } = await pool.query(
        `DELETE FROM transactions
          WHERE user_id = $1 AND account_id = $2 AND is_pending
            AND external_id LIKE $3
            AND transaction_date BETWEEN $4 AND $5
         RETURNING external_id, tag_id`,
        [MOCK_USER_ID, account.id, `${PLUGGY_PREFIX}%`, startDate, endDate]
      );
      const pendingTags = new Map(
        previousPending.filter(r => r.tag_id).map(r => [r.external_id, r.tag_id])
      );

      for (const tx of transactions) {
        results.total++;

        const description = tx.description || tx.descriptionRaw || 'Transação sem descrição';
        const amount = Math.abs(Number(tx.amount) || 0);
        const date = toDateOnly(tx.date);
        const externalId = `${PLUGGY_PREFIX}${tx.id}`;
        const isPending = tx.status === 'PENDING';

        try {
          const { rows } = await pool.query(
            `INSERT INTO transactions
               (id, user_id, description, amount, transaction_type, transaction_date, tag_id, notes, account_id, external_id, is_pending)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO NOTHING
             RETURNING id, tag_id`,
            [
              randomUUID(),
              MOCK_USER_ID,
              description,
              amount,
              tx.type === 'DEBIT' ? 'expense' : 'income',
              date,
              pendingTags.get(externalId) || findMatchingTag(description, tags),
              tx.category ? `Pluggy · ${tx.category}` : 'Pluggy',
              account.id,
              externalId,
              isPending
            ]
          );

          if (rows.length === 0) {
            results.skipped++;
            results.details.push({ status: 'skipped', description, amount, date, reason: 'Transação já importada' });
          } else {
            results.imported++;
            if (isPending) results.pending++;
            results.details.push({
              status: 'imported',
              description,
              amount,
              date,
              reason: isPending ? 'Importado (fatura aberta — pode mudar)' : 'Importado com sucesso',
              transactionId: rows[0].id,
              tagId: rows[0].tag_id
            });
          }
        } catch (error) {
          results.errors++;
          results.details.push({ status: 'error', description, amount, date, reason: error.message });
        }
      }

      await pool.query('UPDATE accounts SET pluggy_last_sync_at = now() WHERE id = $1 AND user_id = $2', [account.id, MOCK_USER_ID]);
    }

    // Uma única vez ao final: o recálculo varre todo o histórico e seria caríssimo por linha.
    await recalculateMonthlyPatrimony();

    res.json({ data: results, error: null });
  } catch (error) {
    console.error('Error POST pluggy/sync:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

// Pede ao Pluggy que atualize o item (limitado a 1x por hora em apps novas).
app.post('/api/pluggy/items/:id/update', async (req, res) => {
  try {
    const item = await triggerItemUpdate(req.params.id);
    res.json({ data: { id: item.id, status: item.status, executionStatus: item.executionStatus }, error: null });
  } catch (error) {
    console.error('Error POST pluggy/items/:id/update:', error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
});

// --- Routes (user-scoped tables) ---
const tables = ['accounts', 'budgets', 'tags', 'transactions'];

tables.forEach(tableName => {
  app.get(`/api/${tableName}`, (req, res) => handleGet(req, res, tableName));
  app.post(`/api/${tableName}`, (req, res) => handlePost(req, res, tableName));
  app.put(`/api/${tableName}/:id`, (req, res) => handlePut(req, res, tableName));
  app.delete(`/api/${tableName}/:id`, (req, res) => handleDelete(req, res, tableName));
});

// Custom Auth Route
app.post('/api/auth/login', (req, res) => {
  // Mock login endpoint
  res.json({ 
    user: { id: MOCK_USER_ID, email: 'local@example.com' },
    session: { access_token: 'local-token' }
  });
});

app.get('/api/auth/user', (req, res) => {
  res.json({ user: { id: MOCK_USER_ID, email: 'local@example.com' } });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Local Postgres API Server running on http://localhost:${PORT}`);
});
