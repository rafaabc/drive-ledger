'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/services/apiService.js';
import Loading from '@/components/Loading.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import { formatDate } from '@/utils/formatDate.js';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.listUsers());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load();
  }, [load]);

  async function handleTogglePlan(user) {
    const nextPlan = user.plan === 'pro' ? 'free' : 'pro';
    setTogglingId(user.id);
    setError('');
    try {
      await adminApi.setUserPlan(user.id, nextPlan);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  }

  function renderTable() {
    if (loading) return <Loading />;
    if (users.length === 0) {
      return <p style={{ color: 'var(--muted)' }}>{t('admin.users.noUsers')}</p>;
    }
    return (
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('admin.users.columns.username')}</th>
              <th>{t('admin.users.columns.email')}</th>
              <th>{t('admin.users.columns.plan')}</th>
              <th>{t('admin.users.columns.planSource')}</th>
              <th>{t('admin.users.columns.role')}</th>
              <th>{t('admin.users.columns.createdAt')}</th>
              <th>{t('admin.users.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const toggling = togglingId === u.id;
              const actionLabel =
                u.plan === 'pro'
                  ? t('admin.users.actions.setFree')
                  : t('admin.users.actions.setPro');
              return (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.plan}</td>
                  <td>{u.planSource}</td>
                  <td>{u.role}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleTogglePlan(u)}
                      disabled={toggling}
                    >
                      {toggling ? t('common.saving') : actionLabel}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="page">
      <PageTitle style={{ marginBottom: '1.5rem' }}>{t('admin.users.heading')}</PageTitle>
      {error && <ErrorBanner message={error} />}
      {renderTable()}
    </div>
  );
}
