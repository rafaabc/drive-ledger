import { CATEGORIES } from '../utils/categories.js';

export default function CategorySelect({ value, onChange, includeAll = false, name = 'category' }) {
  return (
    <select name={name} value={value} onChange={onChange}>
      {includeAll && <option value="">All categories</option>}
      {!includeAll && <option value="">Select category</option>}
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
