// Shared 'lang' cookie helpers — mirrors localStorage['i18nextLng'] server-side so
// app/layout.jsx can pick the right language on first render (SSR) and avoid a
// hydration mismatch against the client's saved preference. localStorage stays the
// source of truth for the client; this cookie only exists for the server to read.
export const LANG_COOKIE = 'lang';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function setLanguageCookie(lang) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

export function readLanguageCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
