import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

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
    const { rows: allTransactions } = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC', [MOCK_USER_ID]);
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local Postgres API Server running on http://localhost:${PORT}`);
});
