import { useState, useEffect, useCallback } from 'react';
import { expensesApi } from '../services/apiService.js';
import CategorySelect from '../components/CategorySelect.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { currentYear } from '../utils/formatDate.js';
import { CATEGORIES } from '../utils/categories.js';
import styles from './SummaryPage.module.css';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  return Math.round(
    Object.values(monthly).reduce((s, row) => s + (row[cat] || 0), 0) * 100
  ) / 100;
}

function rowTotal(row) {
  return Math.round(Object.values(row).reduce((s, v) => s + v, 0) * 100) / 100;
}

export default function SummaryPage() {
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

  useEffect(() => { fetchData(filters); }, [filters, fetchData]);

  function handleChange(e) {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  const targetCategories = filters.category
    ? [filters.category]
    : CATEGORIES.filter((cat) => expenses.some((e) => e.category === cat));

  const monthly = expenses.length > 0 ? buildPivot(expenses, targetCategories) : null;

  const grandTotal = expenses.reduce((s, e) => Math.round((s + e.amount) * 100) / 100, 0);

  const hasData = expenses.length > 0;

  return (
    <div className="page">
      <h2 className="page-title" style={{ marginBottom: '1rem' }}>Expense Summary</h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className={styles.filterForm}>
          <div className={styles.filterField}>
            <label htmlFor="summary-year">Year <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input id="summary-year" type="number" name="year" value={filters.year} onChange={handleChange}
              min="2000" max={currentYear()} />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="summary-category">Category</label>
            <CategorySelect id="summary-category" value={filters.category} onChange={handleChange} includeAll />
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Loading />}

      {!loading && hasData && (
        <div className="card">
          <h3 className={styles.period}>{filters.year}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {targetCategories.map((cat) => <th key={cat} scope="col" className="num">{cat}</th>)}
                  <th scope="col" className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.slice(1).map((name, i) => {
                  const m = i + 1;
                  const row = monthly[m];
                  const total = rowTotal(row);
                  const hasRow = total > 0;
                  return (
                    <tr key={m} style={hasRow ? {} : { color: 'var(--color-muted)' }}>
                      <td>{name}</td>
                      {targetCategories.map((cat) => (
                        <td key={cat} className="num">
                          {row[cat] > 0 ? row[cat].toFixed(2) : '—'}
                        </td>
                      ))}
                      <td className="num">
                        {hasRow ? total.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={styles.totalRow}>
                  <td><strong>Total {filters.year}</strong></td>
                  {targetCategories.map((cat) => (
                    <td key={cat} className="num">
                      {colTotal(monthly, cat).toFixed(2)}
                    </td>
                  ))}
                  <td className="num">
                    {grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && !hasData && !error && filters.year.length === 4 && (
        <p className="text-muted text-center mt-2">No expenses found for {filters.year}.</p>
      )}
    </div>
  );
}
