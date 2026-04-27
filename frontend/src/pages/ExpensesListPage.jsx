import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/apiService.js';
import ExpenseRow from '../components/ExpenseRow.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { currentYear } from '../utils/formatDate.js';
import styles from './ExpensesListPage.module.css';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isValidYear(y) {
  return y === '' || (y.length === 4 && Number(y) >= 2000 && Number(y) <= currentYear());
}

export default function ExpensesListPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    category: '',
    year: String(currentYear()),
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
    setFilters({ category: '', year: String(currentYear()), month: '' });
  }

  function handleDeleted(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <h2 className="page-title">Expenses</h2>
        <button className="btn-primary" onClick={() => navigate('/expenses/new')}>+ New expense</button>
      </div>

      <div className={`card ${styles.filters}`}>
        <div className={styles.filterForm}>
          <div className={styles.filterField}>
            <label htmlFor="filter-category">Category</label>
            <CategorySelect id="filter-category" value={filters.category} onChange={handleFilterChange} includeAll />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-year">Year</label>
            <input id="filter-year" type="number" name="year" value={filters.year} onChange={handleFilterChange}
              placeholder={String(currentYear())} min="2000" max={currentYear()} />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-month">Month</label>
            <select id="filter-month" name="month" value={filters.month} onChange={handleFilterChange}>
              <option value="">All months</option>
              {MONTHS.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterActions}>
            <button type="button" className="btn-secondary" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : expenses.length === 0 ? (
        <p className="text-muted text-center mt-2">No expenses found.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Category</th>
                <th scope="col">Amount</th>
                <th scope="col">Litres</th>
                <th scope="col">Price/L</th>
                <th scope="col">Actions</th>
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
