'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/services/apiService.js';
import { bindField } from '@/utils/form.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import GoogleSignInButton from '@/components/GoogleSignInButton.jsx';
import AuthBrandPanel from '@/components/AuthBrandPanel.jsx';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies.js';
import { detectCurrency } from '@/utils/detectCurrency.js';
import styles from './LoginPage.module.css';

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    inviteCode: '',
    username: '',
    email: '',
    password: '',
    currency: detectCurrency(),
  });
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = bindField(setForm);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register({
        ...form,
        consent: { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() },
      });
      router.push('/login?registered=1');
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
          <h1 className={styles.formHeading}>{t('auth.register.heading')}</h1>

          {error && <ErrorBanner message={error} />}

          <GoogleSignInButton mode="register" onError={setError} inviteCode={form.inviteCode} />

          <div className={styles.divider}>
            <span>{t('common.or')}</span>
          </div>

          <form onSubmit={handleSubmit}>
            {process.env.NEXT_PUBLIC_INVITE_ONLY === 'true' && (
              <div className="form-group">
                <FieldLabelWithHint
                  htmlFor="reg-invite-code"
                  label={t('auth.register.inviteLabel')}
                  hint={t('auth.register.inviteHint')}
                />
                <input
                  id="reg-invite-code"
                  name="inviteCode"
                  value={form.inviteCode}
                  onChange={handleChange}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <FieldLabelWithHint
                htmlFor="reg-username"
                label={t('auth.register.username')}
                hint={t('auth.register.usernameHint')}
              />
              <input
                id="reg-username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_]+"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-email">{t('auth.register.email')}</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <FieldLabelWithHint
                htmlFor="reg-password"
                label={t('auth.register.password')}
                hint={t('auth.passwordHint')}
              />
              <input
                id="reg-password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-currency">{t('auth.register.currency')}</label>
              <select
                id="reg-currency"
                name="currency"
                value={form.currency}
                onChange={handleChange}
              >
                {SUPPORTED_CURRENCIES.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="form-group"
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}
            >
              <input
                id="reg-consent"
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                style={{ marginTop: '0.25rem', flexShrink: 0 }}
              />
              <label
                htmlFor="reg-consent"
                style={{ cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1.4 }}
              >
                {t('auth.register.consentLabel')}{' '}
                <Link href="/privacy" style={{ color: 'var(--primary)' }}>
                  {t('auth.register.privacyPolicy')}
                </Link>{' '}
                {t('auth.register.consentAnd')}{' '}
                <Link href="/terms" style={{ color: 'var(--primary)' }}>
                  {t('auth.register.termsOfService')}
                </Link>
                .
              </label>
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={loading || !consented}
            >
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <p className={styles.switchLink}>
            {t('auth.register.hasAccount')} <Link href="/login">{t('auth.register.signIn')}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
