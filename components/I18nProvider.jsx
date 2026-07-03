'use client';
import { useEffect } from 'react';
import i18n from '@/i18n/index.js';

// Module-level reset: synchronously sets i18n.language before React hydrates.
// useSyncExternalStore (used by useTranslation in react-i18next v14+) validates
// that the language snapshot matches between server ('pt-BR') and client renders.
// Without this, navigating away and back leaves i18n in a non-default language,
// causing a hydration mismatch. The user's saved preference is applied after
// mount in the useEffect below.
i18n.changeLanguage('pt-BR');

export default function I18nProvider({ children }) {
  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && saved !== i18n.language) {
      // Deferred to a macrotask: pages using useSearchParams are wrapped in their
      // own <Suspense> boundary, which can hydrate in a separate pass after this
      // effect runs. Calling changeLanguage() synchronously here mutates the
      // shared i18n store before that boundary hydrates, so its client render
      // diverges from the 'pt-BR' text baked into its SSR HTML — a hydration
      // mismatch. Deferring past the current task lets all boundaries finish
      // hydrating against the SSR-matching language first.
      setTimeout(() => i18n.changeLanguage(saved), 0);
    }
  }, []);
  return children;
}
