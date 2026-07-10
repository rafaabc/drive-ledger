'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { recurringApi } from '@/services/apiService.js';
import AmountField from '@/components/AmountField.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import VehicleSelect from '@/components/VehicleSelect.jsx';
import { useVehicleOptions } from '@/hooks/useVehicleOptions.js';
import { todayISO } from '@/utils/formatDate.js';
import styles from './RecurringFormPage.module.css';

// Fuel is excluded — recurring rules use a fixed amount
const RECURRING_CATEGORIES = ['Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

const EMPTY = {
  category: '',
  description: '',
  amount: '',
  startDate: todayISO(),
  interval: '1',
  active: true,
  vehicleId: '',
};

export default function RecurringFormPage() {
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
    recurringApi
      .get(id)
      .then((rule) => {
        setForm({
          category: rule.category || '',
          description: rule.description || '',
          amount: rule.amount ?? '',
          startDate: rule.startDate?.split('T')[0] || todayISO(),
          interval: String(rule.interval ?? '1'),
          active: rule.active !== false,
          vehicleId: rule.vehicleId || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      category: form.category,
      description: form.description || undefined,
      amount: Number.parseFloat(form.amount),
      startDate: form.startDate,
      interval: Number(form.interval),
      active: form.active,
      vehicleId: form.vehicleId || undefined,
    };

    try {
      if (isEdit) {
        await recurringApi.update(id, payload);
      } else {
        await recurringApi.create(payload);
      }
      router.push('/recurring');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) return <Loading />;

  return (
    <div className="page">
      <div className={`card ${styles.formCard}`}>
        <PageTitle className={styles.heading}>
          {isEdit ? t('recurring.editRule') : t('recurring.newRule')}
        </PageTitle>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit}>
          {vehicles.length > 1 && (
            <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={handleChange} />
          )}
          <div className="form-group">
            <label htmlFor="field-category">{t('recurring.fields.category')}</label>
            <select
              id="field-category"
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">{t('categories.select')}</option>
              {RECURRING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="field-description">{t('recurring.fields.description')}</label>
            <input
              id="field-description"
              name="description"
              type="text"
              value={form.description}
              onChange={handleChange}
              placeholder={t('recurring.fields.descriptionPlaceholder')}
            />
          </div>

          <AmountField value={form.amount} onChange={handleChange} />

          <div className="form-group">
            <label htmlFor="field-startDate">{t('recurring.fields.startDate')}</label>
            <input
              id="field-startDate"
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="field-interval">{t('recurring.fields.interval')}</label>
            <select
              id="field-interval"
              name="interval"
              value={form.interval}
              onChange={handleChange}
            >
              <option value="1">{t('recurring.intervals.monthly')}</option>
              <option value="6">{t('recurring.intervals.every6months')}</option>
              <option value="12">{t('recurring.intervals.every12months')}</option>
            </select>
          </div>

          {isEdit && (
            <div className={`form-group ${styles.checkboxGroup}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={handleChange}
                  className={styles.checkbox}
                />
                {t('recurring.fields.active')}
              </label>
            </div>
          )}

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
