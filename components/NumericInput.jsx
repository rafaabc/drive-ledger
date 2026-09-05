'use client';
import { useTranslation } from 'react-i18next';

// Accepts both ',' and '.' as the decimal separator regardless of app
// language or keyboard layout, displays the separator matching the
// user's locale, and always emits a canonical '.'-decimal string.
export default function NumericInput({
  value,
  onChange,
  name,
  id,
  placeholder,
  min,
  step,
  integer = false,
  ...rest
}) {
  const { i18n } = useTranslation();
  const localeSeparator = i18n.language === 'pt-BR' ? ',' : '.';
  const acceptRe = integer ? /^\d*$/ : /^\d*([.,]\d*)?$/;

  const displayValue = String(value ?? '').replace('.', localeSeparator);
  const localePlaceholder =
    placeholder && localeSeparator !== '.'
      ? placeholder.replace(/(?<=\d)\.(?=\d)/g, localeSeparator)
      : placeholder;

  function handleChange(e) {
    const raw = e.target.value;
    if (raw !== '' && !acceptRe.test(raw)) return;
    onChange({ target: { name, value: raw.replace(',', '.') } });
  }

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      id={id}
      name={name}
      value={displayValue}
      onChange={handleChange}
      placeholder={localePlaceholder}
      min={min}
      step={step}
      {...rest}
    />
  );
}
