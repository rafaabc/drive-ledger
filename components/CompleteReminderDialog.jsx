'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate.js';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import NumericInput from '@/components/NumericInput.jsx';

function addMonths(date, m) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}

export default function CompleteReminderDialog({ open, reminder, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [km, setKm] = useState('');

  if (!open || !reminder) return null;

  const parsed = parseFloat(km);
  const validKm = !isNaN(parsed) && parsed >= 0;

  let previewNextKm = null;
  let previewNextDate = null;
  if (validKm && (reminder.intervalMonths || reminder.intervalKm)) {
    previewNextDate = reminder.intervalMonths
      ? formatDate(addMonths(new Date(), reminder.intervalMonths).toISOString())
      : null;
    previewNextKm = reminder.intervalKm ? parsed + reminder.intervalKm : null;
  }

  function previewText() {
    if (previewNextDate && previewNextKm !== null)
      return t('reminders.actions.completePreviewBoth', {
        nextDate: previewNextDate,
        nextKm: previewNextKm,
      });
    if (previewNextDate)
      return t('reminders.actions.completePreviewDate', { nextDate: previewNextDate });
    if (previewNextKm !== null)
      return t('reminders.actions.completePreviewKm', { nextKm: previewNextKm });
    return null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (validKm) onSubmit(parsed);
  }

  const preview = previewText();

  return (
    <div role="dialog" aria-modal="true" className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit}>
        <h3>{t('reminders.actions.complete')}</h3>
        <div className="form-group">
          <FieldLabelWithHint
            htmlFor="complete-km"
            label={t('reminders.actions.completedKm')}
            hint={t('reminders.actions.completedKmHint')}
          />
          <NumericInput
            id="complete-km"
            name="completedKm"
            integer
            min="0"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            required
          />
        </div>
        {preview && <p>{preview}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!validKm}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
