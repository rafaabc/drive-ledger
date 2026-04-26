const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, options);

  if ((res.status === 401 || res.status === 403) && auth) {
    localStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { expired: true } }));
    const err = new Error('Session expired. Please log in again.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data) => request('/auth/login', { method: 'POST', body: data, auth: false }),
};

export const expensesApi = {
  list: ({ category, year, month } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    const qs = params.toString();
    return request(`/expenses${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/expenses/${id}`),
  create: (data) => request('/expenses', { method: 'POST', body: data }),
  update: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  summary: ({ year, month, category } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    if (category) params.set('category', category);
    return request(`/expenses/summary?${params.toString()}`);
  },
};
