export default function AmountField({ value, onChange }) {
  return (
    <div className="form-group">
      <label>Amount</label>
      <input
        type="number"
        name="amount"
        value={value}
        onChange={onChange}
        min="0.01"
        step="0.01"
        placeholder="e.g. 150.00"
        required
      />
    </div>
  );
}
