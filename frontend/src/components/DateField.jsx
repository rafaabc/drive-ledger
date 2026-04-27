import { todayISO } from '../utils/formatDate.js';

export default function DateField({ value, onChange, name = 'date', id }) {
  return (
    <input
      type="date"
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      max={todayISO()}
      required
    />
  );
}
