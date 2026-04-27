import { CATEGORIES } from '../utils/categories.js';

export default function CategorySelect({ value, onChange, includeAll = false, name = 'category', id }) {
  return (
    <select name={name} value={value} onChange={onChange} id={id}>
      {includeAll && <option value="">All categories</option>}
      {!includeAll && <option value="">Select category</option>}
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
