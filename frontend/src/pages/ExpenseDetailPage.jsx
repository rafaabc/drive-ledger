import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/apiService.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { formatDate } from '../utils/formatDate.js';
import styles from './ExpenseDetailPage.module.css';

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    expensesApi.get(id)
      .then(setExpense)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expensesApi.remove(id);
      navigate('/expenses');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 className="page-title" style={{ marginBottom: '1.25rem' }}>Expense detail</h2>

        {error && <ErrorBanner message={error} />}

        {expense && (
          <>
            <dl className={styles.dl}>
              <dt>Date</dt><dd className={styles.mono}>{formatDate(expense.date)}</dd>
              <dt>Category</dt><dd><span className="badge" data-cat={expense.category}>{expense.category}</span></dd>
              <dt>Amount</dt><dd className={styles.mono}>{expense.amount?.toFixed(2)}</dd>
              {expense.litres != null && <><dt>Litres</dt><dd className={styles.mono}>{expense.litres}</dd></>}
              {expense.price_per_litre != null && <><dt>Price / litre</dt><dd className={styles.mono}>{expense.price_per_litre}</dd></>}
            </dl>

            <div className="actions mt-2">
              <button className="btn-primary" onClick={() => navigate(`/expenses/${id}/edit`)}>Edit</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
              <button className="btn-secondary" onClick={() => navigate('/expenses')}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
