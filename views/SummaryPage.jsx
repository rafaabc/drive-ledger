'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { expensesApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import CategorySelect from '@/components/CategorySelect.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import StackedMonthlyBar from '@/components/charts/StackedMonthlyBar.jsx';
import CategoryDonut from '@/components/charts/CategoryDonut.jsx';
import NumericInput from '@/components/NumericInput.jsx';
import MonthBreakdown from '@/components/MonthBreakdown.jsx';
import breakdownStyles from '@/components/MonthBreakdown.module.css';
import { currentYear, getMonthName } from '@/utils/formatDate.js';
import { CATEGORIES, categoryLabel } from '@/utils/categories.js';
import { aggregateByCategory } from '@/utils/aggregations.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import styles from './SummaryPage.module.css';

function buildPivot(expenses, visibleCategories) {
  const monthly = {};
  for (let m = 1; m <= 12; m++) {
    monthly[m] = {};
    for (const cat of visibleCategories) monthly[m][cat] = 0;
  }
  for (const e of expenses) {
    const m = new Date(e.date).getMonth() + 1;
    if (monthly[m][e.category] !== undefined) {
      monthly[m][e.category] = Math.round((monthly[m][e.category] + e.amount) * 100) / 100;
    }
  }
  return monthly;
}

function colTotal(monthly, cat) {
  return Math.round(Object.values(monthly).reduce((s, row) => s + (row[cat] || 0), 0) * 100) / 100;
}

function rowTotal(row) {
  return Math.round(Object.values(row).reduce((s, v) => s + v, 0) * 100) / 100;
}

function buildBarData(expenses, visibleCategories) {
  const byMonth = {};
  for (const e of expenses) {
    const ym = e.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = { month: ym };
    byMonth[ym][e.category] = Math.round(((byMonth[ym][e.category] ?? 0) + e.amount) * 100) / 100;
  }
  return Object.values(byMonth)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((row) => {
      const filled = { month: row.month };
      for (const cat of visibleCategories) filled[cat] = row[cat] ?? 0;
      return filled;
    });
}

export default function SummaryPage() {
  const { t } = useTranslation();
  const { currency } = useAuth();
  const [filters, setFilters] = useState({ year: String(currentYear()), category: '' });
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (f) => {
    if (!f.year || f.year.length < 4 || Number(f.year) > currentYear()) return;
    setLoading(true);
    setError('');
    try {
      const data = await expensesApi.list({ year: f.year, category: f.category || undefined });
      setExpenses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData is async, setState only after await
    fetchData(filters);
  }, [filters, fetchData]);

  function handleChange(e) {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  const targetCategories = useMemo(
    () =>
      filters.category
        ? [filters.category]
        : CATEGORIES.filter((cat) => expenses.some((e) => e.category === cat)),
    [filters.category, expenses],
  );

  const hasData = expenses.length > 0;

  const barData = useMemo(
    () => (hasData ? buildBarData(expenses, targetCategories) : []),
    [expenses, targetCategories, hasData],
  );

  const donutData = useMemo(
    () => (hasData ? aggregateByCategory(expenses) : []),
    [expenses, hasData],
  );

  const monthly = useMemo(
    () => (hasData ? buildPivot(expenses, targetCategories) : null),
    [expenses, targetCategories, hasData],
  );

  const grandTotal = useMemo(
    () => expenses.reduce((s, e) => Math.round((s + e.amount) * 100) / 100, 0),
    [expenses],
  );

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('summary.heading')}</PageTitle>
      </div>

      <div className={`card ${styles.filterCard}`}>
        <div className={styles.filterForm}>
          <div className={styles.filterField}>
            <label htmlFor="summary-year">
              {t('summary.year')}{' '}
              <span aria-hidden="true" style={{ color: 'var(--danger)' }}>
                *
              </span>
            </label>
            <NumericInput
              id="summary-year"
              name="year"
              integer
              value={filters.year}
              onChange={handleChange}
              min="2000"
              max={currentYear()}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="summary-category">{t('summary.category')}</label>
            <CategorySelect
              id="summary-category"
              value={filters.category}
              onChange={handleChange}
              includeAll
            />
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Loading />}

      {!loading && hasData && (
        <>
          <div className={styles.chartsGrid}>
            <div className="card">
              <h3 className={styles.sectionTitle}>{t('summary.byMonth')}</h3>
              <StackedMonthlyBar data={barData} categories={targetCategories} />
            </div>
            <div className="card">
              <h3 className={styles.sectionTitle}>{t('summary.byCategory')}</h3>
              <CategoryDonut data={donutData} currency={currency} />
            </div>
          </div>

          {/* Desktop pivot table */}
          <details className={`card ${styles.pivotSection} ${styles.pivotDesktop}`} open>
            <summary className={styles.pivotSummary}>
              <span className={styles.period}>
                {filters.year} {t('summary.breakdown')}
              </span>
            </summary>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('summary.month')}</th>
                    {targetCategories.map((cat) => (
                      <th key={cat} scope="col" className="num">
                        {categoryLabel(cat, t)}
                      </th>
                    ))}
                    <th scope="col" className="num">
                      {t('summary.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const row = monthly[m];
                    const total = rowTotal(row);
                    const hasRow = total > 0;
                    return (
                      <tr key={m} style={hasRow ? {} : { color: 'var(--muted)' }}>
                        <td>{getMonthName(m)}</td>
                        {targetCategories.map((cat) => (
                          <td key={cat} className="num">
                            {row[cat] > 0 ? formatCurrency(row[cat], currency) : '—'}
                          </td>
                        ))}
                        <td className="num">{hasRow ? formatCurrency(total, currency) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow}>
                    <td>
                      <strong>
                        {t('summary.total')} {filters.year}
                      </strong>
                    </td>
                    {targetCategories.map((cat) => (
                      <td key={cat} className="num">
                        {formatCurrency(colTotal(monthly, cat), currency)}
                      </td>
                    ))}
                    <td className="num">{formatCurrency(grandTotal, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>

          {/* Mobile category bars */}
          <div className={`card ${styles.pivotMobile}`}>
            <h3 className={styles.sectionTitle}>
              {filters.year} {t('summary.byCategory')}
            </h3>
            {donutData.length === 0 ? (
              <p className="text-muted">{t('summary.noData')}</p>
            ) : (
              <div className={styles.catBars}>
                {donutData
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map(({ category, total }) => {
                    const max = donutData.reduce((m, d) => Math.max(m, d.total), 0);
                    const pct = max > 0 ? (total / max) * 100 : 0;
                    return (
                      <div key={category} className={styles.catBarRow}>
                        <div className={styles.catBarMeta}>
                          <span className="badge" data-cat={category}>
                            {categoryLabel(category, t)}
                          </span>
                          <span className={styles.catBarValue}>
                            {formatCurrency(total, currency)}
                          </span>
                        </div>
                        <div className={styles.catBarTrack}>
                          <div
                            className={styles.catBarFill}
                            style={{
                              width: `${pct}%`,
                              '--cat-color': `var(--cat-${category.toLowerCase()})`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className={styles.catBarTotal}>
                  <span>{t('summary.total')}</span>
                  <span className={styles.catBarValue}>{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile month breakdown */}
          <div className={`card ${styles.pivotMobile}`} data-testid="mobile-month-breakdown">
            <h3 className={styles.sectionTitle}>
              {filters.year} {t('summary.breakdown')}
            </h3>
            <MonthBreakdown
              rows={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const row = monthly[m];
                const total = rowTotal(row);
                const hasRow = total > 0;
                if (!hasRow) return { month: m, empty: true };
                return {
                  month: m,
                  headlineValue: formatCurrency(total, currency),
                  details: targetCategories
                    .filter((cat) => row[cat] > 0)
                    .map((cat) => (
                      <div key={cat} className={breakdownStyles.monthDetailRow}>
                        <span className="badge" data-cat={cat}>
                          {categoryLabel(cat, t)}
                        </span>
                        <span className={breakdownStyles.value}>
                          {formatCurrency(row[cat], currency)}
                        </span>
                      </div>
                    )),
                };
              })}
              footer={
                <>
                  <span>
                    {t('summary.total')} {filters.year}
                  </span>
                  <span className={breakdownStyles.value}>
                    {formatCurrency(grandTotal, currency)}
                  </span>
                </>
              }
            />
          </div>
        </>
      )}

      {!loading && !hasData && !error && filters.year.length === 4 && (
        <p className="text-muted text-center mt-2">{t('summary.noData')}</p>
      )}
    </div>
  );
}
