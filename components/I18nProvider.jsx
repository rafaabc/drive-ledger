'use client';
import { useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/index.js';
import { setLanguageCookie, readLanguageCookie } from '@/utils/languageCookie.js';

// app/layout.jsx reads the 'lang' cookie and passes it here as initialLanguage so SSR
// renders the language the visitor already picked — without this, the server always
// rendered pt-BR while a client with localStorage['i18nextLng']='en' rendered English,
// producing a hydration mismatch on every page.
export default function I18nProvider({ children, initialLanguage = 'pt-BR' }) {
  const isServer = typeof window === 'undefined';

  // Server: a per-request clone so one request's language can never leak into another's
  // on a reused Fluid Compute instance (the shared i18n singleton is module-scoped).
  const serverInstance = useMemo(() => {
    if (!isServer) return null;
    return i18n.cloneInstance({ lng: initialLanguage, initImmediate: false });
  }, [isServer, initialLanguage]);

  // Client: sync the singleton to the SSR'd language *before* hydration finishes, so the
  // client's first render matches the HTML the server sent. Only matters when the two
  // diverge (e.g. i18n's default lng vs. what the cookie said).
  if (!isServer && i18n.language !== initialLanguage) {
    i18n.changeLanguage(initialLanguage);
  }

  useEffect(() => {
    // First-visit migration only: a visitor with a saved localStorage preference but no
    // 'lang' cookie yet (pre-existing users, or cookies cleared) gets the cookie written
    // so the *next* SSR agrees with their client pref. Once the cookie exists this is a
    // no-op forever after.
    if (readLanguageCookie()) return;
    const saved = localStorage.getItem('i18nextLng');
    if (!saved || saved === initialLanguage) return;
    setLanguageCookie(saved);
    i18n.changeLanguage(saved);
  }, [initialLanguage]);

  if (isServer) {
    return <I18nextProvider i18n={serverInstance}>{children}</I18nextProvider>;
  }
  return children;
}
