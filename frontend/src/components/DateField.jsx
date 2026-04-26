import { todayISO } from '../utils/formatDate.js';

export default function DateField({ value, onChange, name = 'date' }) {
  return (
    <input
      type="date"
      name={name}
      value={value}
      onChange={onChange}
      max={todayISO()}
      required
    />
  );
}
