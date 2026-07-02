import * as Sentry from '@sentry/nextjs';
import i18n from '@/i18n/index.js';
import { API_ERROR_MAP } from '@/i18n/apiErrors.js';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body = null, auth = true, signal = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);
  if (signal) options.signal = signal;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch (networkErr) {
    Sentry.captureException(networkErr, { extra: { path, method } });
    throw networkErr;
  }

  if (res.status === 401 && auth) {
    localStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { expired: true } }));
    const err = new Error(i18n.t('errors.sessionExpired'));
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const rawMessage = data.message || `Request failed: ${res.status}`;
    const i18nKey = API_ERROR_MAP[rawMessage];
    const message = i18nKey ? i18n.t(i18nKey) : i18n.t('errors.generic');
    const err = new Error(message);
    err.status = res.status;
    if (res.status >= 500) {
      Sentry.captureException(err, { extra: { path, method, serverMessage: rawMessage } });
    }
    throw err;
  }

  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data) => request('/auth/login', { method: 'POST', body: data, auth: false }),
  changePassword: (data) => request('/auth/password', { method: 'PATCH', body: data, auth: true }),
  updateCurrency: (data) => request('/auth/currency', { method: 'PATCH', body: data, auth: true }),
  updateLanguage: (data) => request('/auth/language', { method: 'PATCH', body: data, auth: true }),
  forgotPassword: (data) =>
    request('/auth/forgot-password', { method: 'POST', body: data, auth: false }),
  resetPassword: (data) =>
    request('/auth/reset-password', { method: 'POST', body: data, auth: false }),
  googleLogin: (data) => request('/auth/google', { method: 'POST', body: data, auth: false }),
  linkGoogle: (data) => request('/auth/google/link', { method: 'POST', body: data, auth: true }),
  unlinkGoogle: () => request('/auth/google/link', { method: 'DELETE', auth: true }),
  getProviders: () => request('/auth/providers', { auth: true }),
  updateOdometer: (data) => request('/auth/odometer', { method: 'PATCH', body: data, auth: true }),
  verifyEmail: (data) => request('/auth/verify-email', { method: 'POST', body: data, auth: false }),
  resendVerification: () => request('/auth/resend-verification', { method: 'POST', auth: true }),
  exportData: () => request('/auth/me/export', { auth: true }),
  deleteAccount: (data) => request('/auth/me', { method: 'DELETE', body: data, auth: true }),
  getAccessInfo: () => request('/auth/me/access', { auth: true }),
};

export const expensesApi = {
  list: ({ category, year, month } = {}, signal = null) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    const qs = params.toString();
    return request(`/expenses${qs ? `?${qs}` : ''}`, { signal });
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

export const recurringApi = {
  list: () => request('/recurring'),
  get: (id) => request(`/recurring/${id}`),
  create: (data) => request('/recurring', { method: 'POST', body: data }),
  update: (id, data) => request(`/recurring/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),
  catchUp: () => request('/recurring/catch-up', { method: 'POST' }),
};

export const vehiclesApi = {
  list: () => request('/vehicles'),
  get: (id) => request(`/vehicles/${id}`),
  create: (data) => request('/vehicles', { method: 'POST', body: data }),
  update: (id, data) => request(`/vehicles/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => request(`/vehicles/${id}`, { method: 'DELETE' }),
};

export const remindersApi = {
  list: ({ status } = {}, signal = null) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return request(`/reminders${qs ? `?${qs}` : ''}`, { signal });
  },
  get: (id) => request(`/reminders/${id}`),
  create: (data) => request('/reminders', { method: 'POST', body: data }),
  update: (id, data) => request(`/reminders/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/reminders/${id}`, { method: 'DELETE' }),
  complete: (id, data) => request(`/reminders/${id}/complete`, { method: 'POST', body: data }),
  badgeCount: () => request('/reminders/badge-count'),
};
