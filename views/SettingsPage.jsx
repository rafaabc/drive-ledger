'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Car, DollarSign, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext.jsx';
import { useAsyncAction } from '@/hooks/useAsyncAction.js';
import { useAutoClear } from '@/hooks/useAutoClear.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import GoogleSignInButton from '@/components/GoogleSignInButton.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import { authApi } from '@/services/apiService.js';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies.js';
import styles from './SettingsPage.module.css';

function ProBadge({ t }) {
  return (
    <span
      style={{
        background: 'var(--primary-dim)',
        border: '1px solid var(--primary-glow)',
        color: 'var(--primary)',
        borderRadius: '999px',
        fontFamily: 'var(--font-display)',
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        padding: '0.08rem 0.4rem',
      }}
    >
      {t('common.pro')}
    </span>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    username,
    currency,
    updateCurrency,
    language,
    updateLanguage,
    emailVerified,
    logout,
    plan,
  } = useAuth();
  const [selected, setSelected] = useState(currency);
  const [selectedLang, setSelectedLang] = useState(language);

  const currencyAction = useAsyncAction();
  const langAction = useAsyncAction();
  const resendAction = useAsyncAction();

  useAutoClear(currencyAction.success, currencyAction.setSuccess);
  useAutoClear(langAction.success, langAction.setSuccess);
  useAutoClear(resendAction.success, resendAction.setSuccess);

  const [providers, setProviders] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    authApi
      .getProviders()
      .then(setProviders)
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await currencyAction.run(() => updateCurrency(selected));
  }

  async function handleLangSubmit(e) {
    e.preventDefault();
    await langAction.run(() => updateLanguage(selectedLang));
  }

  async function handleUnlink() {
    setLinkError('');
    setLinkSuccess('');
    setUnlinking(true);
    try {
      await authApi.unlinkGoogle();
      setLinkSuccess(t('settings.googleDisconnected'));
      setProviders((p) => ({
        ...p,
        authProviders: p.authProviders.filter((x) => x !== 'google'),
      }));
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setUnlinking(false);
    }
  }

  const googleLinked = providers?.authProviders?.includes('google');

  async function handleExport() {
    setExportError('');
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'norevify-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setExportError(err.message);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount(
        providers?.hasPassword ? { password: deletePassword } : undefined,
      );
      logout();
      router.push('/login?deleted=1');
    } catch (err) {
      setDeleteError(err.message);
      setDeleteLoading(false);
    }
  }

  return (
    <div className="page">
      <PageTitle style={{ marginBottom: '1.5rem' }}>{t('settings.heading')}</PageTitle>
      <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>
        {t('settings.loggedInAs')} <strong style={{ color: 'var(--text)' }}>{username}</strong>
      </p>

      {currencyAction.success && (
        <ErrorBanner message={t('settings.currency.success')} type="success" />
      )}
      {currencyAction.error && <ErrorBanner message={currencyAction.error} />}

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div className="form-group">
          <label htmlFor="settings-currency">{t('settings.currency.label')}</label>
          <select
            id="settings-currency"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              currencyAction.setSuccess(false);
            }}
          >
            {SUPPORTED_CURRENCIES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={currencyAction.loading || selected === currency}
        >
          {currencyAction.loading ? t('common.saving') : t('common.save')}
        </button>
      </form>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      {langAction.success && (
        <ErrorBanner message={t('settings.language.success')} type="success" />
      )}
      {langAction.error && <ErrorBanner message={langAction.error} />}

      <form onSubmit={handleLangSubmit} style={{ maxWidth: '400px' }}>
        <div className="form-group">
          <label htmlFor="settings-language">{t('settings.language.label')}</label>
          <select
            id="settings-language"
            value={selectedLang}
            onChange={(e) => {
              setSelectedLang(e.target.value);
              langAction.setSuccess(false);
            }}
            disabled={langAction.loading}
          >
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={langAction.loading || selectedLang === language}
        >
          {langAction.loading ? t('common.saving') : t('common.save')}
        </button>
      </form>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {t('settings.linkedAccounts')}
      </h2>

      {linkSuccess && <ErrorBanner message={linkSuccess} type="success" />}
      {linkError && <ErrorBanner message={linkError} />}

      {providers &&
        (googleLinked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              {t('settings.googleConnected')}
            </span>
            {providers.hasPassword ? (
              <button
                className={styles.settingsLink}
                onClick={handleUnlink}
                disabled={unlinking}
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                {unlinking ? t('settings.disconnecting') : t('settings.disconnectGoogle')}
              </button>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                {t('settings.setPasswordFirst')}
              </span>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: '300px' }}>
            <GoogleSignInButton
              mode="link"
              onSuccess={() => {
                setLinkSuccess(t('settings.googleConnected'));
                setProviders((p) => ({
                  ...p,
                  authProviders: [...(p?.authProviders ?? []), 'google'],
                }));
              }}
              onError={setLinkError}
            />
          </div>
        ))}

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      {emailVerified === false && (
        <>
          <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            {t('auth.verifyEmail.heading')}
          </h2>
          {resendAction.success && (
            <ErrorBanner message={t('auth.verifyEmail.resendSuccess')} type="success" />
          )}
          {resendAction.error && <ErrorBanner message={resendAction.error} />}
          <button
            className="btn-secondary"
            onClick={() => resendAction.run(() => authApi.resendVerification())}
            disabled={resendAction.loading}
          >
            {resendAction.loading ? t('auth.verifyEmail.resending') : t('auth.verifyEmail.resend')}
          </button>
        </>
      )}

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      <Link href="/vehicles" className={styles.settingsLink}>
        <Car size={16} />
        {t('nav.vehicles')}
      </Link>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      <Link href="/income" className={styles.settingsLink}>
        <DollarSign size={16} />
        {t('nav.income')}
        {plan !== 'pro' && <ProBadge t={t} />}
      </Link>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      <Link href="/reports" className={styles.settingsLink}>
        <FileText size={16} />
        {t('nav.reports')}
        {plan !== 'pro' && <ProBadge t={t} />}
      </Link>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />

      <Link href="/change-password" className={styles.settingsLink}>
        <KeyRound size={16} />
        {t('settings.changePassword')}
      </Link>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--border)' }} />
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {t('settings.myData.heading')}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        {t('settings.myData.description')}
      </p>
      {exportError && <ErrorBanner message={exportError} />}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={handleExport}>
          {t('settings.myData.export')}
        </button>
        <button
          className="btn-secondary"
          style={{ color: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
          onClick={() => setShowDeleteModal(true)}
        >
          {t('settings.myData.deleteAccount')}
        </button>
      </div>

      {showDeleteModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowDeleteModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowDeleteModal(false)}
          role="button"
          tabIndex={-1}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 style={{ marginBottom: '1rem' }}>{t('settings.deleteAccount.heading')}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {t('settings.deleteAccount.warning')}
            </p>
            {providers?.hasPassword && (
              <div className="form-group">
                <label htmlFor="delete-password">{t('settings.deleteAccount.passwordLabel')}</label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
            )}
            {deleteError && (
              <p
                style={{
                  color: 'var(--danger, #ef4444)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                }}
              >
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                style={{
                  background: 'var(--danger, #ef4444)',
                  borderColor: 'var(--danger, #ef4444)',
                }}
                onClick={handleDeleteAccount}
                disabled={deleteLoading || (providers?.hasPassword && !deletePassword)}
              >
                {deleteLoading
                  ? t('settings.deleteAccount.deleting')
                  : t('settings.deleteAccount.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
