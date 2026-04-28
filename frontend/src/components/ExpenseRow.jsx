import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { expensesApi } from '../services/apiService.js';
import { formatDate } from '../utils/formatDate.js';
import styles from './ExpenseRow.module.css';

export default function ExpenseRow({ expense, onDeleted }) {
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm(`Delete this ${expense.category} expense?`)) return;
    await expensesApi.remove(expense.id);
    onDeleted(expense.id);
  }

  return (
    <tr>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '.8rem', color: 'var(--text-2)' }}>
        {formatDate(expense.date)}
      </td>
      <td>
        <span className="badge" data-cat={expense.category}>{expense.category}</span>
      </td>
      <td style={{ color: 'var(--text-2)', fontSize: '.875rem' }}>
        {expense.description || <span style={{ color: 'var(--muted)' }}>—</span>}
      </td>
      <td className="num">{expense.amount?.toFixed(2)}</td>
      <td>
        <div className="actions">
          <button
            className={styles.iconBtn}
            onClick={() => navigate(`/expenses/${expense.id}/edit`)}
            title="Edit"
            aria-label="Edit expense"
          >
            <Pencil size={15} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete expense"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
