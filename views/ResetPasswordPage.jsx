'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/services/apiService.js';
import { bindField } from '@/utils/form.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import AuthBrandPanel from '@/components/AuthBrandPanel.jsx';
import styles from './LoginPage.module.css';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Captured once on mount: the URL is stripped of the token right below,
  // so re-reading searchParams after that would return null.
  const [token] = useState(() => searchParams.get('token'));

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace('/forgot-password');
      return;
    }
    // Drop the one-time token from the address bar/history so it can't be
    // picked up by page-view analytics, browser history, or a screen share —
    // it stays valid in `token` state for the actual reset request below.
    if (searchParams.get('token')) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, [token]);

  const handleChange = bindField(setForm);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: form.newPassword });
      router.push('/login?passwordChanged=1');
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
          <h1 className={styles.formHeading}>{t('auth.resetPassword.heading')}</h1>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <FieldLabelWithHint
                htmlFor="reset-password"
                label={t('auth.resetPassword.newPassword')}
                hint={t('auth.passwordHint')}
              />
              <input
                id="reset-password"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={handleChange}
                required
                minLength={8}
                maxLength={20}
                autoFocus
              />
            </div>
            <div className="form-group">
              <FieldLabelWithHint
                htmlFor="reset-confirm"
                label={t('auth.resetPassword.confirm')}
                hint={t('auth.confirmPasswordHint')}
              />
              <input
                id="reset-confirm"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                maxLength={20}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
            </button>
          </form>

          <p className={styles.switchLink}>
            <Link href="/forgot-password">{t('auth.resetPassword.requestNew')}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
