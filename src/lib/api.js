const API_URL = 'http://localhost:3001/api';

export const api = {
  async get(resource, params = {}) {
    const url = new URL(`${API_URL}/${resource}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },

  async post(resource, data) {
    const response = await fetch(`${API_URL}/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },

  async put(resource, id, data) {
    const response = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },

  async delete(resource, id) {
    const response = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }
};

export const auth = {
  async login() {
    const response = await fetch(`${API_URL}/auth/login`, { method: 'POST' });
    const data = await response.json();
    localStorage.setItem('local_session', JSON.stringify(data.session));
    localStorage.setItem('local_user', JSON.stringify(data.user));
    return { data, error: null };
  },
  
  async getUser() {
    const userStr = localStorage.getItem('local_user');
    if (userStr) {
      return { data: { user: JSON.parse(userStr) }, error: null };
    }
    return { data: { user: null }, error: null };
  },

  async getSession() {
    const sessionStr = localStorage.getItem('local_session');
    if (sessionStr) {
      return { data: { session: JSON.parse(sessionStr) }, error: null };
    }
    return { data: { session: null }, error: null };
  },
  
  async signOut() {
    localStorage.removeItem('local_session');
    localStorage.removeItem('local_user');
    return { error: null };
  }
};
