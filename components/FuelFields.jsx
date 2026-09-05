'use client';
import { useTranslation } from 'react-i18next';
import FieldLabelWithHint from '@/components/FieldLabelWithHint.jsx';
import NumericInput from '@/components/NumericInput.jsx';

export default function FuelFields({ litres, pricePerLitre, odometer = '', onChange }) {
  const { t, i18n } = useTranslation();
  const computedRaw =
    parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0
      ? Math.round(parseFloat(litres) * parseFloat(pricePerLitre) * 100) / 100
      : null;
  const locale = i18n.language === 'en' ? 'en-US' : 'pt-BR';
  const computed =
    computedRaw !== null
      ? computedRaw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

  return (
    <>
      <div className="form-group">
        <FieldLabelWithHint
          htmlFor="field-litres"
          label={t('expenses.fields.litres')}
          hint={t('expenses.fields.decimalHint')}
        />
        <NumericInput
          id="field-litres"
          name="litres"
          value={litres}
          onChange={onChange}
          min="0.01"
          step="0.01"
          placeholder="e.g. 40"
          required
        />
      </div>
      <div className="form-group">
        <FieldLabelWithHint
          htmlFor="field-price-per-litre"
          label={t('expenses.fields.pricePerLitre')}
          hint={t('expenses.fields.decimalHint')}
        />
        <NumericInput
          id="field-price-per-litre"
          name="price_per_litre"
          value={pricePerLitre}
          onChange={onChange}
          min="0.01"
          step="0.01"
          placeholder="e.g. 5.50"
          required
        />
      </div>
      <div className="form-group">
        <FieldLabelWithHint
          htmlFor="field-odometer"
          label={t('expenses.fields.odometer')}
          hint={t('expenses.fields.odometerHint')}
        />
        <NumericInput
          id="field-odometer"
          name="odometer"
          value={odometer}
          onChange={onChange}
          integer
          min="0"
          placeholder="e.g. 12500"
        />
      </div>
      <div className="form-group">
        <FieldLabelWithHint
          htmlFor="field-amount"
          label={t('expenses.fields.amount')}
          hint={t('expenses.fields.amountTooltip')}
        />
        <input
          id="field-amount"
          type="text"
          value={computed ?? ''}
          disabled
          readOnly
          onChange={() => {}}
          style={{
            background: 'var(--surface)',
            border: 'none',
            color: computed ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'not-allowed',
          }}
        />
      </div>
    </>
  );
}
