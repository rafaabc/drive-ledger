'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { bindField } from '@/utils/form.js';
import { useAsyncAction } from '@/hooks/useAsyncAction.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import PageTitle from '@/components/PageTitle.jsx';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { username } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const { loading, error, success, setError, run } = useAsyncAction();

  const handleChange = bindField(setForm);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    await run(async () => {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    });
  }

  return (
    <div className="page">
      <PageTitle style={{ marginBottom: '1.5rem' }}>{t('auth.changePassword.heading')}</PageTitle>
      <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>
        {t('settings.loggedInAs')} <strong style={{ color: 'var(--text)' }}>{username}</strong>
      </p>

      {success && <ErrorBanner message={t('auth.changePassword.success')} type="success" />}
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div className="form-group">
          <label htmlFor="cp-currentPassword">{t('auth.changePassword.current')}</label>
          <input
            id="cp-currentPassword"
            type="password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="cp-newPassword"
            label={t('auth.changePassword.new')}
            hint={t('auth.passwordHint')}
          />
          <input
            id="cp-newPassword"
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            required
            minLength={8}
            maxLength={20}
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="cp-confirmPassword"
            label={t('auth.changePassword.confirm')}
            hint={t('auth.confirmPasswordHint')}
          />
          <input
            id="cp-confirmPassword"
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            minLength={8}
            maxLength={20}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? t('auth.changePassword.submitting') : t('auth.changePassword.submit')}
        </button>
      </form>
    </div>
  );
}
