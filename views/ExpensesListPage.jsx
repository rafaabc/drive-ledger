'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Filter, FileX2, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { expensesApi, recurringApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import ExpenseRow from '@/components/ExpenseRow.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import { CATEGORIES, categoryLabel } from '@/utils/categories.js';
import { currentYear, formatDate } from '@/utils/formatDate.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import styles from './ExpensesListPage.module.css';

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DEFAULT_YEAR = String(currentYear());

function buildYearOptions() {
  const cy = currentYear();
  return [cy, cy - 1, cy - 2, cy - 3, cy - 4].filter((y) => y >= 2000);
}

function ExpenseCard({ expense, onDeleted, onError, router, currency }) {
  const { t } = useTranslation();

  async function handleDelete() {
    if (!window.confirm(t('expenses.confirmDelete'))) return;
    try {
      await expensesApi.remove(expense.id);
      onDeleted(expense.id);
    } catch (err) {
      onError?.(err.message);
    }
  }

  return (
    <div className={styles.expenseCard}>
      <div className={styles.cardTop}>
        <span className={styles.cardDate}>{formatDate(expense.date)}</span>
        <span className="badge" data-cat={expense.category}>
          {categoryLabel(expense.category, t)}
        </span>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardAmount}>{formatCurrency(expense.amount, currency)}</span>
        {expense.category === 'Fuel' && expense.litres != null && (
          <span className={styles.cardSub}>
            {expense.litres}L · {formatCurrency(expense.price_per_litre, currency)}/L
          </span>
        )}
      </div>
      <div className={styles.cardActions}>
        <button
          className={styles.iconBtn}
          onClick={() => router.push(`/expenses/${expense.id}/edit`)}
          aria-label={t('common.edit')}
          type="button"
        >
          <Pencil size={16} />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          onClick={handleDelete}
          aria-label={t('common.delete')}
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ExpensesListPage() {
  const { t } = useTranslation();
  const { currency } = useAuth();
  const router = useRouter();

  const [filters, setFilters] = useState({
    category: '',
    year: DEFAULT_YEAR,
    month: '',
  });

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchExpenses = useCallback(async (f, signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await expensesApi.list(f, signal);
      setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fire-and-forget catch-up on mount so any overdue recurring expenses are created
  // before the list loads. Idempotent — safe to run on every visit.
  useEffect(() => {
    recurringApi.catchUp().catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchExpenses is async, setState only after await
    fetchExpenses(filters, controller.signal);
    return () => controller.abort();
  }, [filters, fetchExpenses]);

  function handleFilterChange(e) {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function clearFilters() {
    setFilters({ category: '', year: DEFAULT_YEAR, month: '' });
  }

  function handleDeleted(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const hasActiveFilters =
    filters.category !== '' || filters.year !== DEFAULT_YEAR || filters.month !== '';

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('expenses.heading')}</PageTitle>
        <button className="btn-primary" onClick={() => router.push('/expenses/new')}>
          + {t('common.new')}
        </button>
      </div>

      <div className={styles.toolbarWrap}>
        <button
          type="button"
          className={styles.filterToggle}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <Filter size={15} aria-hidden="true" />
          {t('expenses.filters')}
          {hasActiveFilters
            ? ` (${[filters.category, filters.year !== DEFAULT_YEAR ? filters.year : '', filters.month].filter(Boolean).length})`
            : ''}
          {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className={`${styles.toolbar} ${filtersOpen ? styles.toolbarOpen : ''}`}>
          <Filter size={16} className={styles.toolbarIcon} aria-hidden="true" />

          <select
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            className={styles.toolbarSelect}
            aria-label="Filter by category"
          >
            <option value="">{t('expenses.filterCategory')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, t)}
              </option>
            ))}
          </select>

          <select
            name="year"
            value={filters.year}
            onChange={handleFilterChange}
            className={styles.toolbarSelect}
            aria-label="Filter by year"
          >
            <option value="">{t('expenses.filterYear')}</option>
            {buildYearOptions().map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          <select
            name="month"
            value={filters.month}
            onChange={handleFilterChange}
            className={styles.toolbarSelect}
            aria-label="Filter by month"
          >
            <option value="">{t('expenses.filterMonth')}</option>
            {MONTHS.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              {t('expenses.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : expenses.length === 0 ? (
        <div className={styles.emptyState}>
          <FileX2 size={48} className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyText}>{t('expenses.noExpenses')}</p>
          <Link
            href="/expenses/new"
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            + {t('common.new')}
          </Link>
        </div>
      ) : (
        <>
          <div className={`card ${styles.tableCard}`} style={{ padding: 0, overflow: 'hidden' }}>
            <div className={styles.tableScroll}>
              <table className={styles.expenseTable}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.thDate}>
                      {t('expenses.date')}
                    </th>
                    <th scope="col" className={styles.thCategory}>
                      {t('expenses.category')}
                    </th>
                    <th scope="col" className={`num ${styles.thAmount}`}>
                      {t('expenses.amount')}
                    </th>
                    <th scope="col" className={styles.thActions}>
                      <span className="sr-only">{t('expenses.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <ExpenseRow
                      key={exp.id}
                      expense={exp}
                      onDeleted={handleDeleted}
                      onError={setError}
                      currency={currency}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.cardList}>
            {expenses.map((exp) => (
              <ExpenseCard
                key={exp.id}
                expense={exp}
                onDeleted={handleDeleted}
                onError={setError}
                router={router}
                currency={currency}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
