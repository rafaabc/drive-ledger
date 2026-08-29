'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext.jsx';
import { authApi } from '@/services/apiService.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import styles from './LoginPage.module.css';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { login } = useAuth();

  const [verifyToken] = useState(() => searchParams.get('token'));
  const [status, setStatus] = useState(verifyToken ? 'verifying' : 'error');
  const [errorMsg, setErrorMsg] = useState(verifyToken ? '' : t('auth.verifyEmail.invalid'));
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!verifyToken) return;
    // Drop the one-time token from the address bar/history so it can't be
    // picked up by page-view analytics, browser history, or a screen share.
    if (searchParams.get('token')) router.replace(pathname);
    authApi
      .verifyEmail({ token: verifyToken })
      .then(({ token: newToken }) => {
        login(newToken);
        setStatus('success');
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  async function handleResend() {
    setResendError('');
    setResendSuccess(false);
    setResendLoading(true);
    try {
      await authApi.resendVerification();
      setResendSuccess(true);
    } catch (err) {
      setResendError(err.message);
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className={styles.screen}>
      <main className={styles.formPanel} style={{ justifyContent: 'center' }}>
        <div className={styles.formCard} style={{ textAlign: 'center' }}>
          <h1 className={styles.formHeading}>{t('auth.verifyEmail.heading')}</h1>

          {status === 'verifying' && (
            <p style={{ color: 'var(--muted)' }}>{t('auth.verifyEmail.verifying')}</p>
          )}

          {status === 'success' && (
            <>
              <ErrorBanner message={t('auth.verifyEmail.success')} type="success" />
              <button
                className="btn-primary"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => router.push('/dashboard')}
              >
                {t('auth.verifyEmail.goToDashboard')}
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorBanner message={errorMsg} />
              {resendSuccess && (
                <ErrorBanner message={t('auth.verifyEmail.resendSuccess')} type="success" />
              )}
              {resendError && <ErrorBanner message={resendError} />}
              <button
                className="btn-secondary"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={handleResend}
                disabled={resendLoading || resendSuccess}
              >
                {resendLoading ? t('auth.verifyEmail.resending') : t('auth.verifyEmail.resend')}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
