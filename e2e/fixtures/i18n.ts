import { Page, expect } from '@playwright/test';

export async function setLanguage(page: Page, lang: string) {
  // Also set the 'lang' cookie the app mirrors client-side (utils/languageCookie.js) so
  // SSR renders the target language immediately on reload — setting localStorage alone
  // leaves the cookie stale/absent, so the server-rendered HTML briefly shows the wrong
  // language until the client's post-hydration migration effect corrects it, which is a
  // race real returning visitors (whose cookie is already in sync) never hit.
  await page.evaluate((l) => {
    localStorage.setItem('i18nextLng', l);
    document.cookie = `lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, lang);
  await page.reload();
}

export async function switchToLanguage(page: Page, lang: string) {
  await page.goto('/settings');
  await page.locator('#settings-language').selectOption(lang);
  const langForm = page.locator('form', { has: page.locator('#settings-language') });
  await langForm.getByRole('button', { name: /Salvar|Save/i }).click();
}

export async function expectEnglishNav(page: Page) {
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Summary' })).toBeVisible();
}

export async function expectPtBrNav(page: Page) {
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Despesas' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resumo' })).toBeVisible();
}
