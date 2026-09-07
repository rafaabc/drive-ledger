import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n/index.js';
import I18nProvider from '@/components/I18nProvider';
import { setLanguageCookie, readLanguageCookie } from '@/utils/languageCookie.js';

vi.mock('@/i18n/index.js', () => ({
  default: { language: 'pt-BR', changeLanguage: vi.fn(), cloneInstance: vi.fn() },
}));

vi.mock('@/utils/languageCookie.js', () => ({
  setLanguageCookie: vi.fn(),
  readLanguageCookie: vi.fn(),
}));

describe('I18nProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.language = 'pt-BR';
  });

  it('should render children', () => {
    render(
      <I18nProvider>
        <span>hello</span>
      </I18nProvider>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('syncs the singleton to initialLanguage on the client when it differs', () => {
    render(
      <I18nProvider initialLanguage="en">
        <span>x</span>
      </I18nProvider>,
    );
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('does not call changeLanguage when i18n.language already matches initialLanguage', () => {
    render(
      <I18nProvider initialLanguage="pt-BR">
        <span>x</span>
      </I18nProvider>,
    );
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  it('migrates a saved localStorage preference to the cookie when the cookie is missing', () => {
    readLanguageCookie.mockReturnValue(null);
    localStorage.setItem('i18nextLng', 'en');
    render(
      <I18nProvider initialLanguage="pt-BR">
        <span>x</span>
      </I18nProvider>,
    );
    expect(setLanguageCookie).toHaveBeenCalledWith('en');
  });

  it('does not migrate when the cookie is already set', () => {
    readLanguageCookie.mockReturnValue('pt-BR');
    localStorage.setItem('i18nextLng', 'en');
    render(
      <I18nProvider initialLanguage="pt-BR">
        <span>x</span>
      </I18nProvider>,
    );
    expect(setLanguageCookie).not.toHaveBeenCalled();
  });

  it('does not migrate when localStorage is empty', () => {
    readLanguageCookie.mockReturnValue(null);
    render(
      <I18nProvider initialLanguage="pt-BR">
        <span>x</span>
      </I18nProvider>,
    );
    expect(setLanguageCookie).not.toHaveBeenCalled();
  });
});
