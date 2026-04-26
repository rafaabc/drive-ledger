import { useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/apiService.js';
import { formatDate } from '../utils/formatDate.js';

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
      <td className="num">{expense.amount?.toFixed(2)}</td>
      <td className="num">{expense.litres != null ? expense.litres : '—'}</td>
      <td className="num">{expense.price_per_litre != null ? expense.price_per_litre.toFixed(2) : '—'}</td>
      <td>
        <div className="actions">
          <button className="btn-ghost" onClick={() => navigate(`/expenses/${expense.id}/edit`)}>Edit</button>
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDelete}>Delete</button>
        </div>
      </td>
    </tr>
  );
}
