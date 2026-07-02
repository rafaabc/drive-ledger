'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { remindersApi } from '@/services/apiService.js';
import { categoryLabel } from '@/utils/categories.js';
import { formatDate } from '@/utils/formatDate.js';
import { useAutoClear } from '@/hooks/useAutoClear.js';
import ReminderStatusBadge from '@/components/ReminderStatusBadge.jsx';
import CompleteReminderDialog from '@/components/CompleteReminderDialog.jsx';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import styles from './RemindersListPage.module.css';

export default function RemindersListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState('active');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [completing, setCompleting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useAutoClear(successMsg, setSuccessMsg);

  const load = useCallback(async () => {
    try {
      const status = tab === 'active' ? 'active' : 'done';
      setItems(await remindersApi.list({ status }));
    } catch (e) {
      setError(e.message);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load();
  }, [load]);

  async function handleComplete(km) {
    try {
      await remindersApi.complete(completing.id, { completedKm: km });
      setCompleting(null);
      load();
      window.dispatchEvent(new CustomEvent('reminders:changed'));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete() {
    try {
      await remindersApi.remove(deleting.id);
      setDeleting(null);
      load();
      setSuccessMsg(t('reminders.actions.deleteSuccess'));
      window.dispatchEvent(new CustomEvent('reminders:changed'));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('reminders.heading')}</PageTitle>
        <Link href="/reminders/new" className="btn-primary">
          + {t('common.new')}
        </Link>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'active' ? styles.tabActive : styles.tab}
          onClick={() => setTab('active')}
        >
          {t('reminders.tabs.active')}
        </button>
        <button
          type="button"
          className={tab === 'history' ? styles.tabActive : styles.tab}
          onClick={() => setTab('history')}
        >
          {t('reminders.tabs.history')}
        </button>
      </div>

      {successMsg && <ErrorBanner type="success" message={successMsg} />}
      {error && <ErrorBanner message={error} />}

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{t('reminders.noReminders')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((r) => (
            <li key={r.id} className={styles.row}>
              <div className={styles.info}>
                <span className="badge" data-cat={r.type}>
                  {categoryLabel(r.type, t)}
                </span>
                {r.title && <span className={styles.subtitle}> — {r.title}</span>}
                <div className={styles.meta}>
                  {r.dueDate && <span>{formatDate(r.dueDate)}</span>}
                  {r.dueKm != null && <span> · {r.dueKm} km</span>}
                </div>
              </div>
              <div className={styles.footer}>
                <ReminderStatusBadge status={r.status} />
                <div className={styles.actions}>
                  {tab === 'active' && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => router.push(`/reminders/${r.id}/edit`)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setCompleting(r)}
                      >
                        {t('reminders.actions.complete')}
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-danger" onClick={() => setDeleting(r)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CompleteReminderDialog
        open={!!completing}
        reminder={completing}
        onSubmit={handleComplete}
        onCancel={() => setCompleting(null)}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        requireDouble={deleting?.status === 'done'}
        message={t('reminders.actions.confirmDelete')}
        messages={[
          t('reminders.actions.confirmDeleteHistory'),
          t('reminders.actions.confirmDeleteHistory2'),
        ]}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
