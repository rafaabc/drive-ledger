import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import i18n from '@/i18n/index.js';
import I18nProvider from '@/components/I18nProvider';

vi.mock('@/i18n/index.js', () => ({
  default: { language: 'pt-BR', changeLanguage: vi.fn() },
}));

describe('I18nProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should render children', () => {
    render(
      <I18nProvider>
        <span>hello</span>
      </I18nProvider>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('should call changeLanguage when localStorage has a different language', async () => {
    localStorage.setItem('i18nextLng', 'en');
    await act(async () => {
      render(
        <I18nProvider>
          <span>x</span>
        </I18nProvider>,
      );
    });
    // The apply is deferred to a macrotask (see I18nProvider.jsx) so it doesn't
    // race Suspense-boundary hydration elsewhere in the tree.
    act(() => {
      vi.runAllTimers();
    });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('should not call changeLanguage when localStorage matches i18n.language', async () => {
    localStorage.setItem('i18nextLng', 'pt-BR');
    await act(async () => {
      render(
        <I18nProvider>
          <span>x</span>
        </I18nProvider>,
      );
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  it('should not call changeLanguage when localStorage is empty', async () => {
    await act(async () => {
      render(
        <I18nProvider>
          <span>x</span>
        </I18nProvider>,
      );
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });
});
