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
    res.json({ data: rows, error: null });
  } catch (error) {
    console.error(`Error DELETE ${tableName}:`, error);
    res.status(500).json({ error: { message: error.message }, data: null });
  }
};

// --- Routes ---
const tables = ['accounts', 'budgets', 'tags', 'transactions', 'exchange_rates'];

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
