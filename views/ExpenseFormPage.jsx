'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { expensesApi } from '@/services/apiService.js';
import CategorySelect from '@/components/CategorySelect.jsx';
import DateField from '@/components/DateField.jsx';
import FuelFields from '@/components/FuelFields.jsx';
import AmountField from '@/components/AmountField.jsx';
import VehicleSelect from '@/components/VehicleSelect.jsx';
import { useVehicleOptions } from '@/hooks/useVehicleOptions.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import { todayISO } from '@/utils/formatDate.js';
import styles from './ExpenseFormPage.module.css';

const EMPTY = {
  date: todayISO(),
  category: '',
  litres: '',
  price_per_litre: '',
  amount: '',
  odometer: '',
  vehicleId: '',
};

export default function ExpenseFormPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params?.id;
  const isEdit = Boolean(id);
  const router = useRouter();

  const [form, setForm] = useState(EMPTY);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const vehicles = useVehicleOptions(isEdit, setForm);

  useEffect(() => {
    if (!isEdit) return;
    expensesApi
      .get(id)
      .then((exp) => {
        setForm({
          date: exp.date?.split('T')[0] || todayISO(),
          category: exp.category || '',
          litres: exp.litres ?? '',
          price_per_litre: exp.price_per_litre ?? '',
          amount: exp.amount ?? '',
          odometer: exp.odometer ?? '',
          vehicleId: exp.vehicleId || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === 'category') {
        next.litres = '';
        next.price_per_litre = '';
        next.amount = '';
        next.odometer = '';
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
    if (form.vehicleId) payload.vehicleId = form.vehicleId;

    if (isFuel) {
      payload.litres = parseFloat(form.litres);
      payload.price_per_litre = parseFloat(form.price_per_litre);
      if (form.odometer !== '') payload.odometer = Number(form.odometer);
    } else {
      payload.amount = parseFloat(form.amount);
    }

    try {
      if (isEdit) {
        await expensesApi.update(id, payload);
      } else {
        await expensesApi.create(payload);
      }
      router.push('/expenses');
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
      <div className={`card ${styles.formCard}`}>
        <PageTitle className={styles.heading}>
          {isEdit ? t('expenses.editExpense') : t('expenses.newExpense')}
        </PageTitle>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit}>
          {vehicles.length > 1 && (
            <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={handleChange} />
          )}
          <div className="form-group">
            <FieldLabelWithHint
              htmlFor="field-date"
              label={t('expenses.fields.date')}
              hint={t('expenses.fields.dateHint')}
            />
            <DateField id="field-date" value={form.date} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="field-category">{t('expenses.fields.category')}</label>
            <CategorySelect id="field-category" value={form.category} onChange={handleChange} />
          </div>

          {form.category &&
            (isFuel ? (
              <FuelFields
                litres={form.litres}
                pricePerLitre={form.price_per_litre}
                odometer={form.odometer}
                onChange={handleChange}
              />
            ) : (
              <AmountField value={form.amount} onChange={handleChange} />
            ))}

          <div className={`actions ${styles.submitRow}`}>
            <button type="submit" className="btn-primary" disabled={saving || !form.category}>
              <Check size={15} aria-hidden="true" />
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              <X size={15} aria-hidden="true" />
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
