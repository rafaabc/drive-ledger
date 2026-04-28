import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Filter, FileX2 } from 'lucide-react';
import { expensesApi } from '../services/apiService.js';
import ExpenseRow from '../components/ExpenseRow.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { CATEGORIES } from '../utils/categories.js';
import { currentYear } from '../utils/formatDate.js';
import styles from './ExpensesListPage.module.css';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_YEAR = String(currentYear());

function isValidYear(y) {
  return y === '' || (y.length === 4 && Number(y) >= 2000 && Number(y) <= currentYear());
}

function buildYearOptions() {
  const cy = currentYear();
  return [cy + 2, cy + 1, cy, cy - 1, cy - 2].filter((y) => y >= 2000);
}

export default function ExpensesListPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    category: '',
    year: DEFAULT_YEAR,
    month: '',
  });

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchExpenses = useCallback(async (f) => {
    if (!isValidYear(f.year)) return;
    setLoading(true);
    setError('');
    try {
      const data = await expensesApi.list(f);
      setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpenses(filters); }, [filters, fetchExpenses]);

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
    filters.category !== '' ||
    filters.year !== DEFAULT_YEAR ||
    filters.month !== '';

  return (
    <div className="page">
      {/* Header */}
      <div className={styles.header}>
        <h2 className="page-title">Expenses</h2>
        <button className="btn-primary" onClick={() => navigate('/expenses/new')}>
          + New expense
        </button>
      </div>

      {/* Filter toolbar */}
      <div className={styles.toolbar}>
        <Filter size={16} className={styles.toolbarIcon} aria-hidden="true" />

        <select
          name="category"
          value={filters.category}
          onChange={handleFilterChange}
          className={styles.toolbarSelect}
          aria-label="Filter by category"
        >
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          name="year"
          value={filters.year}
          onChange={handleFilterChange}
          className={styles.toolbarSelect}
          aria-label="Filter by year"
        >
          <option value="">Year</option>
          {buildYearOptions().map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <select
          name="month"
          value={filters.month}
          onChange={handleFilterChange}
          className={styles.toolbarSelect}
          aria-label="Filter by month"
        >
          <option value="">Month</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button type="button" className={styles.clearBtn} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : expenses.length === 0 ? (
        <div className={styles.emptyState}>
          <FileX2 size={48} className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyText}>
            {hasActiveFilters ? 'No expenses match your filters' : 'No expenses yet'}
          </p>
          <Link to="/expenses/new" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            + New expense
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Category</th>
                <th scope="col">Description</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <ExpenseRow key={exp.id} expense={exp} onDeleted={handleDeleted} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
