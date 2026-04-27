import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/apiService.js';
import CategorySelect from '../components/CategorySelect.jsx';
import DateField from '../components/DateField.jsx';
import FuelFields from '../components/FuelFields.jsx';
import AmountField from '../components/AmountField.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { todayISO } from '../utils/formatDate.js';

const EMPTY = { date: todayISO(), category: '', litres: '', price_per_litre: '', amount: '' };

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    expensesApi.get(id)
      .then((exp) => {
        setForm({
          date: exp.date?.split('T')[0] || todayISO(),
          category: exp.category || '',
          litres: exp.litres ?? '',
          price_per_litre: exp.price_per_litre ?? '',
          amount: exp.amount ?? '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // When category changes, clear fuel vs non-fuel fields
      if (name === 'category') {
        next.litres = '';
        next.price_per_litre = '';
        next.amount = '';
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const isFuel = form.category === 'Fuel';
    const payload = { date: form.date, category: form.category };

    if (isFuel) {
      payload.litres = parseFloat(form.litres);
      payload.price_per_litre = parseFloat(form.price_per_litre);
    } else {
      payload.amount = parseFloat(form.amount);
    }

    try {
      if (isEdit) {
        await expensesApi.update(id, payload);
      } else {
        await expensesApi.create(payload);
      }
      navigate('/expenses');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) return <Loading />;

  const isFuel = form.category === 'Fuel';

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 className="page-title" style={{ marginBottom: '1.25rem' }}>{isEdit ? 'Edit expense' : 'New expense'}</h2>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="field-date">Date</label>
            <DateField id="field-date" value={form.date} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="field-category">Category</label>
            <CategorySelect id="field-category" value={form.category} onChange={handleChange} />
          </div>

          {form.category && (
            isFuel ? (
              <FuelFields
                litres={form.litres}
                pricePerLitre={form.price_per_litre}
                onChange={handleChange}
              />
            ) : (
              <AmountField value={form.amount} onChange={handleChange} />
            )
          )}

          <div className="actions mt-2">
            <button type="submit" className="btn-primary" disabled={saving || !form.category}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create expense'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
