'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { bindField } from '@/utils/form.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import GoogleSignInButton from '@/components/GoogleSignInButton.jsx';
import AuthBrandPanel from '@/components/AuthBrandPanel.jsx';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, expiredBanner, clearExpiredBanner } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showRegistered, setShowRegistered] = useState(searchParams.get('registered') === '1');
  const [showLoggedOut, setShowLoggedOut] = useState(searchParams.get('loggedOut') === '1');
  const [showPasswordChanged, setShowPasswordChanged] = useState(
    searchParams.get('passwordChanged') === '1',
  );
  const [showDeleted, setShowDeleted] = useState(searchParams.get('deleted') === '1');

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showRegistered) return;
    const timer = setTimeout(() => setShowRegistered(false), 3000);
    return () => clearTimeout(timer);
  }, [showRegistered]);

  useEffect(() => {
    if (!showLoggedOut) return;
    const timer = setTimeout(() => setShowLoggedOut(false), 3000);
    return () => clearTimeout(timer);
  }, [showLoggedOut]);

  useEffect(() => {
    if (!showPasswordChanged) return;
    const timer = setTimeout(() => setShowPasswordChanged(false), 3000);
    return () => clearTimeout(timer);
  }, [showPasswordChanged]);

  useEffect(() => {
    if (!showDeleted) return;
    const timer = setTimeout(() => setShowDeleted(false), 3000);
    return () => clearTimeout(timer);
  }, [showDeleted]);

  useEffect(() => {
    if (!expiredBanner) return;
    const timer = setTimeout(clearExpiredBanner, 3000);
    return () => clearTimeout(timer);
  }, [expiredBanner, clearExpiredBanner]);

  const handleChange = bindField(setForm);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    clearExpiredBanner();
    setLoading(true);
    try {
      const { token } = await authApi.login(form);
      login(token);
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.screen}>
      <AuthBrandPanel />

      <main className={styles.formPanel}>
        <div className={styles.formCard}>
          <h1 className={styles.formHeading}>{t('auth.login.heading')}</h1>

          {expiredBanner && <ErrorBanner message={t('auth.login.sessionExpired')} type="info" />}
          {showLoggedOut && <ErrorBanner message={t('auth.login.loggedOut')} type="success" />}
          {showRegistered && (
            <ErrorBanner message={t('auth.login.accountCreated')} type="success" />
          )}
          {showPasswordChanged && (
            <ErrorBanner message={t('auth.login.passwordChanged')} type="success" />
          )}
          {showDeleted && <ErrorBanner message={t('auth.login.accountDeleted')} type="success" />}
          {error && <ErrorBanner message={error} />}

          <GoogleSignInButton mode="login" onError={setError} />

          <div className={styles.divider}>
            <span>{t('common.or')}</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <FieldLabelWithHint
                htmlFor="login-username"
                label={t('auth.login.usernameLabel')}
                hint={t('auth.login.usernameHint')}
              />
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">{t('auth.register.password')}</label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <p className={styles.switchLink}>
            {t('auth.login.noAccount')} <Link href="/register">{t('auth.login.register')}</Link>
          </p>
          <p className={styles.switchLink}>
            <Link href="/forgot-password">{t('auth.login.forgotPassword')}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
