'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { decodeJwt } from '@/utils/decodeJwt.js';
import { authApi } from '@/services/apiService.js';
import { DEFAULT_CURRENCY } from '@/constants/currencies.js';
import i18n from '@/i18n/index.js';
import posthog from 'posthog-js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage init is SSR-safe only in effects
    if (stored) setToken(stored);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'token') setToken(e.newValue);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  const [expiredBanner, setExpiredBanner] = useState(false);
  const router = useRouter();

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setExpiredBanner(false);
    const payload = decodeJwt(newToken);
    if (payload?.language && !localStorage.getItem('i18nextLng')) {
      localStorage.setItem('i18nextLng', payload.language);
      i18n.changeLanguage(payload.language);
    }
    if (payload?.id) posthog.identify(payload.id, { username: payload.username });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    posthog.reset();
    router.push('/login?loggedOut=1');
  }, [router]);

  useEffect(() => {
    function handleExpiry() {
      setToken(null);
      setExpiredBanner(true);
      router.push('/login');
    }
    window.addEventListener('auth:logout', handleExpiry);
    return () => window.removeEventListener('auth:logout', handleExpiry);
  }, [router]);

  const decoded = token ? decodeJwt(token) : null;
  const username = decoded?.username ?? null;
  const currency = decoded?.currency ?? DEFAULT_CURRENCY;
  const language = decoded?.language ?? 'pt-BR';
  const emailVerified = decoded?.emailVerified ?? null;
  const plan = decoded?.plan ?? 'free';
  const role = decoded?.role ?? 'user';
  const reminderEmailsEnabled = decoded?.reminderEmailsEnabled ?? true;

  const updateCurrency = useCallback(async (newCurrency) => {
    const { token: newToken } = await authApi.updateCurrency({ currency: newCurrency });
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const updateLanguage = useCallback(async (newLanguage) => {
    const { token: newToken } = await authApi.updateLanguage({ language: newLanguage });
    localStorage.setItem('token', newToken);
    setToken(newToken);
    localStorage.setItem('i18nextLng', newLanguage);
    i18n.changeLanguage(newLanguage);
  }, []);

  const updateNotificationPrefs = useCallback(async (enabled) => {
    const { token: newToken } = await authApi.updateNotificationPrefs({
      reminderEmailsEnabled: enabled,
    });
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const refreshPlan = useCallback(async () => {
    const { token: newToken } = await authApi.refreshToken();
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthed: !!token,
        authLoading,
        username,
        currency,
        language,
        emailVerified,
        plan,
        role,
        reminderEmailsEnabled,
        updateCurrency,
        updateLanguage,
        updateNotificationPrefs,
        refreshPlan,
        login,
        logout,
        expiredBanner,
        clearExpiredBanner: () => setExpiredBanner(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
