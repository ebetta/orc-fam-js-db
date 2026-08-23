// Cliente da API do Pluggy (Open Finance).
// Documentação: https://docs.pluggy.ai
//
// As credenciais (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET) nunca saem daqui:
// o frontend só conversa com as rotas /api/pluggy/* do server.js.

const PLUGGY_BASE = 'https://api.pluggy.ai';

// A apiKey do Pluggy vale 2 horas; renovamos com folga.
const API_KEY_TTL_MS = 100 * 60 * 1000;

let cachedApiKey = null;
let cachedApiKeyAt = 0;

export function isPluggyConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export function getConfiguredItemIds() {
  return (process.env.PLUGGY_ITEM_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

async function requestApiKey() {
  if (!isPluggyConfigured()) {
    throw new Error('Pluggy não configurado: defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env');
  }

  const response = await fetch(`${PLUGGY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao autenticar no Pluggy (${response.status}): ${body}`);
  }

  const { apiKey } = await response.json();
  return apiKey;
}

async function getApiKey() {
  if (cachedApiKey && Date.now() - cachedApiKeyAt < API_KEY_TTL_MS) {
    return cachedApiKey;
  }
  cachedApiKey = await requestApiKey();
  cachedApiKeyAt = Date.now();
  return cachedApiKey;
}

async function pluggyFetch(path, init = {}, isRetry = false) {
  const apiKey = await getApiKey();
  const url = path.startsWith('http') ? path : `${PLUGGY_BASE}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      ...(init.headers || {})
    }
  });

  // Chave expirada/revogada: renova uma vez e tenta de novo.
  if ((response.status === 401 || response.status === 403) && !isRetry) {
    cachedApiKey = null;
    return pluggyFetch(path, init, true);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pluggy ${init.method || 'GET'} ${path} falhou (${response.status}): ${body}`);
  }

  return response.json();
}

export function fetchItem(itemId) {
  return pluggyFetch(`/items/${itemId}`);
}

export async function fetchAccounts(itemId) {
  const { results } = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return results || [];
}

/**
 * O campo "next" da v2 vem como querystring relativa (ex.: "?accountId=...&after=..."),
 * mas aceitamos também uma URL absoluta por segurança.
 */
function nextPath(next) {
  if (!next) return null;
  if (next.startsWith('http')) return next;
  return `/v2/transactions${next.startsWith('?') ? '' : '?'}${next}`;
}

/**
 * Busca todas as transações de uma conta no período, seguindo a paginação por
 * cursor da v2 (o GET /transactions paginado por número está deprecado).
 */
export async function fetchTransactions(accountId, { from, to } = {}) {
  // A v2 nomeia os filtros dateFrom/dateTo e rejeita pageSize (páginas são fixas em 500).
  const params = new URLSearchParams({ accountId });
  if (from) params.set('dateFrom', from);
  if (to) params.set('dateTo', to);

  const transactions = [];
  let path = `/v2/transactions?${params.toString()}`;

  while (path) {
    const page = await pluggyFetch(path);
    transactions.push(...(page.results || []));
    path = nextPath(page.next);
  }

  return transactions;
}

/**
 * Dispara uma atualização do item no Pluggy. Aplicações novas são limitadas a
 * uma chamada por hora — não chamar automaticamente.
 */
export function triggerItemUpdate(itemId) {
  return pluggyFetch(`/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({}) });
}
