'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import { recurringApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import PropTypes from 'prop-types';
import { formatCurrency } from '@/utils/formatCurrency.js';
import styles from './RecurringListPage.module.css';

function intervalLabel(interval, t) {
  if (interval === 1) return t('recurring.intervals.monthly');
  if (interval === 6) return t('recurring.intervals.every6months');
  if (interval === 12) return t('recurring.intervals.every12months');
  return String(interval);
}

function RecurringCard({ rule, onDelete, router, currency, t }) {
  return (
    <div className={styles.recurringCard}>
      <div className={styles.cardTop}>
        <span className="badge" data-cat={rule.category}>
          {t(`categories.${rule.category}`)}
        </span>
        <span className={rule.active ? styles.activeYes : styles.activeNo}>
          {rule.active ? t('recurring.status.active') : t('recurring.status.inactive')}
        </span>
      </div>
      {rule.description && <p className={styles.cardDesc}>{rule.description}</p>}
      <div className={styles.cardBody}>
        <span className={styles.cardAmount}>{formatCurrency(rule.amount, currency)}</span>
        <span className={styles.cardInterval}>{intervalLabel(rule.interval, t)}</span>
      </div>
      <div className={styles.cardActions}>
        <button
          className={styles.iconBtn}
          onClick={() => router.push(`/recurring/${rule.id}/edit`)}
          aria-label={t('common.edit')}
          type="button"
        >
          <Pencil size={16} />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          onClick={() => onDelete(rule.id)}
          aria-label={t('common.delete')}
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

RecurringCard.propTypes = {
  rule: PropTypes.shape({
    id: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    description: PropTypes.string,
    amount: PropTypes.number.isRequired,
    interval: PropTypes.number.isRequired,
    active: PropTypes.bool.isRequired,
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
  router: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
  currency: PropTypes.string,
  t: PropTypes.func.isRequired,
};

export default function RecurringListPage() {
  const { t } = useTranslation();
  const { currency } = useAuth();
  const router = useRouter();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await recurringApi.list();
      setRules(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchRules is async, setState only after await
    fetchRules();
  }, [fetchRules]);

  async function handleDelete(id) {
    if (!globalThis.confirm(t('recurring.confirmDelete'))) return;
    try {
      await recurringApi.remove(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  let content;
  if (loading) {
    content = <Loading />;
  } else if (rules.length === 0) {
    content = (
      <div className={styles.emptyState}>
        <RefreshCw size={48} className={styles.emptyIcon} aria-hidden="true" />
        <p className={styles.emptyText}>{t('recurring.noRules')}</p>
      </div>
    );
  } else {
    content = (
      <>
        <div className={`card ${styles.tableCard}`} style={{ padding: 0, overflow: 'hidden' }}>
          <div className={styles.tableScroll}>
            <table className={styles.rulesTable}>
              <thead>
                <tr>
                  <th scope="col">{t('recurring.fields.category')}</th>
                  <th scope="col">{t('recurring.fields.description')}</th>
                  <th scope="col" className="num">
                    {t('recurring.fields.amount')}
                  </th>
                  <th scope="col">{t('recurring.fields.interval')}</th>
                  <th scope="col">{t('recurring.fields.status')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('expenses.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="badge" data-cat={rule.category}>
                        {t(`categories.${rule.category}`)}
                      </span>
                    </td>
                    <td className={styles.descCell}>{rule.description || '—'}</td>
                    <td className="num">{formatCurrency(rule.amount, currency)}</td>
                    <td>{intervalLabel(rule.interval, t)}</td>
                    <td>
                      <span className={rule.active ? styles.activeYes : styles.activeNo}>
                        {rule.active
                          ? t('recurring.status.active')
                          : t('recurring.status.inactive')}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => router.push(`/recurring/${rule.id}/edit`)}
                        aria-label={t('common.edit')}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => handleDelete(rule.id)}
                        aria-label={t('common.delete')}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.cardList}>
          {rules.map((rule) => (
            <RecurringCard
              key={rule.id}
              rule={rule}
              onDelete={handleDelete}
              router={router}
              currency={currency}
              t={t}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('recurring.heading')}</PageTitle>
        <button className="btn-primary" onClick={() => router.push('/recurring/new')}>
          + {t('common.new')}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {content}
    </div>
  );
}
