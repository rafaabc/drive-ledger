import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { expensesApi } from '../services/apiService.js';
import { formatDate } from '../utils/formatDate.js';
import styles from './ExpenseRow.module.css';

export default function ExpenseRow({ expense, onDeleted, onError }) {
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm(`Delete this ${expense.category} expense?`)) return;
    try {
      await expensesApi.remove(expense.id);
      onDeleted(expense.id);
    } catch (err) {
      onError?.(err.message);
    }
  }

  const dateLabel = formatDate(expense.date);

  return (
    <tr>
      <td className={styles.dateCell}>{dateLabel}</td>
      <td>
        <span className="badge" data-cat={expense.category}>{expense.category}</span>
      </td>
      <td className="num">{expense.amount?.toFixed(2)}</td>
      <td>
        <div className="actions">
          <button
            className={styles.iconBtn}
            onClick={() => navigate(`/expenses/${expense.id}/edit`)}
            title={`Edit ${expense.category} expense`}
            aria-label={`Edit ${expense.category} expense from ${dateLabel}`}
          >
            <Pencil size={15} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={handleDelete}
            title={`Delete ${expense.category} expense`}
            aria-label={`Delete ${expense.category} expense from ${dateLabel}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
