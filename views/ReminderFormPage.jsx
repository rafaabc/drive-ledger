'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import ReminderTypeSelect from '@/components/ReminderTypeSelect.jsx';
import VehicleSelect from '@/components/VehicleSelect.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import NumericInput from '@/components/NumericInput.jsx';
import { remindersApi } from '@/services/apiService.js';
import { useAsyncAction } from '@/hooks/useAsyncAction.js';
import { useVehicleOptions } from '@/hooks/useVehicleOptions.js';
import { todayISO } from '@/utils/formatDate.js';

const EMPTY = {
  type: 'Maintenance',
  title: '',
  dueDate: '',
  dueKm: '',
  intervalMonths: '',
  intervalKm: '',
  vehicleId: '',
};

export default function ReminderFormPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [loadError, setLoadError] = useState('');
  const action = useAsyncAction();
  const vehicles = useVehicleOptions(isEdit, setForm);

  useEffect(() => {
    if (!isEdit) return;
    remindersApi
      .get(id)
      .then((r) => {
        setForm({
          type: r.type,
          title: r.title || '',
          dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
          dueKm: r.dueKm ?? '',
          intervalMonths: r.intervalMonths ?? '',
          intervalKm: r.intervalKm ?? '',
          vehicleId: r.vehicleId || '',
        });
      })
      .catch((e) => setLoadError(e.message));
  }, [id, isEdit]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function buildBody() {
    const body = { type: form.type };
    if (form.title) body.title = form.title;
    if (form.dueDate) body.dueDate = new Date(form.dueDate).toISOString();
    if (form.dueKm !== '') body.dueKm = Number(form.dueKm);
    if (form.intervalMonths !== '') body.intervalMonths = Number(form.intervalMonths);
    if (form.intervalKm !== '') body.intervalKm = Number(form.intervalKm);
    if (form.vehicleId) body.vehicleId = form.vehicleId;
    return body;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.dueDate && form.dueKm === '') {
      action.setError(t('errors.reminderMissingDue'));
      return;
    }
    await action.run(async () => {
      if (isEdit) await remindersApi.update(id, buildBody());
      else await remindersApi.create(buildBody());
      router.push('/reminders');
    });
  }

  return (
    <div className="page">
      <PageTitle>{isEdit ? t('reminders.editReminder') : t('reminders.newReminder')}</PageTitle>
      {loadError && <ErrorBanner message={loadError} />}
      {action.error && <ErrorBanner message={action.error} />}
      <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
        {vehicles.length > 1 && (
          <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={handleChange} />
        )}
        <ReminderTypeSelect value={form.type} onChange={handleChange} />
        <div className="form-group">
          <label htmlFor="field-title">{t('reminders.fields.title')}</label>
          <input
            id="field-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            maxLength={120}
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="field-dueDate"
            label={t('reminders.fields.dueDate')}
            hint={t('reminders.fields.dueHint')}
          />
          <input
            id="field-dueDate"
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={handleChange}
            min={todayISO()}
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="field-dueKm"
            label={t('reminders.fields.dueKm')}
            hint={t('reminders.fields.dueHint')}
          />
          <NumericInput
            id="field-dueKm"
            name="dueKm"
            integer
            min="0"
            value={form.dueKm}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="field-intervalMonths"
            label={t('reminders.fields.intervalMonths')}
            hint={t('reminders.fields.intervalHint')}
          />
          <NumericInput
            id="field-intervalMonths"
            name="intervalMonths"
            integer
            min="0"
            value={form.intervalMonths}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="field-intervalKm"
            label={t('reminders.fields.intervalKm')}
            hint={t('reminders.fields.intervalHint')}
          />
          <NumericInput
            id="field-intervalKm"
            name="intervalKm"
            integer
            min="0"
            value={form.intervalKm}
            onChange={handleChange}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn-primary" disabled={action.loading}>
            {action.loading ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/reminders')}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
