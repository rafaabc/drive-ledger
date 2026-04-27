import { APIRequestContext } from '@playwright/test';
import { DEFAULT_PASSWORD, uniqueUsername, todayISO } from './test-data';

export async function createAndLoginUser(
  request: APIRequestContext,
  prefix = 'user'
): Promise<{ username: string; token: string }> {
  const username = uniqueUsername(prefix);
  await request.post('/api/auth/register', {
    data: { username, password: DEFAULT_PASSWORD },
  });
  const res = await request.post('/api/auth/login', {
    data: { username, password: DEFAULT_PASSWORD },
  });
  const { token } = await res.json();
  return { username, token };
}

export async function createExpenseViaApi(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown>
): Promise<{ id: number; category: string; amount: number; [key: string]: unknown }> {
  const payload = { date: todayISO(), ...data };
  const res = await request.post('/api/expenses', {
    data: payload,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
