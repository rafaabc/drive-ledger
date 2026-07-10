'use client';
import { useTranslation } from 'react-i18next';

export default function VehicleSelect({ vehicles, value, onChange, id = 'field-vehicleId' }) {
  const { t } = useTranslation();
  return (
    <div className="form-group">
      <label htmlFor={id}>{t('vehicles.selectLabel')}</label>
      <select id={id} name="vehicleId" value={value} onChange={onChange}>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}
