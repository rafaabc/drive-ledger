export default function FuelFields({ litres, pricePerLitre, onChange }) {
  const computed = (parseFloat(litres) > 0 && parseFloat(pricePerLitre) > 0)
    ? (Math.round(parseFloat(litres) * parseFloat(pricePerLitre) * 100) / 100).toFixed(2)
    : null;

  return (
    <>
      <div className="form-group">
        <label htmlFor="field-litres">Litres</label>
        <input
          id="field-litres"
          type="number"
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
        <label htmlFor="field-price-per-litre">Price per litre</label>
        <input
          id="field-price-per-litre"
          type="number"
          name="price_per_litre"
          value={pricePerLitre}
          onChange={onChange}
          min="0.01"
          step="0.01"
          placeholder="e.g. 5.50"
          required
        />
      </div>
      {computed && (
        <div className="form-group">
          <label>Computed amount</label>
          <div style={{
            padding: '.5rem .8rem',
            background: 'var(--primary-dim)',
            border: '1px solid rgba(245,158,11,.22)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '.9rem',
            color: 'var(--primary)',
            fontWeight: 600,
          }}>
            {computed}
          </div>
        </div>
      )}
    </>
  );
}
