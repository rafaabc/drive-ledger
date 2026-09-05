import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AmountField from '@/components/AmountField';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));

describe('AmountField', () => {
  it('should render label', () => {
    render(<AmountField value="" onChange={vi.fn()} />);
    expect(screen.getByText('expenses.fields.amount')).toBeInTheDocument();
  });

  it('should render numeric input with correct attrs', () => {
    render(<AmountField value="50.00" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('50.00');
    expect(input).toHaveAttribute('name', 'amount');
  });

  it('should call onChange on input change', () => {
    const onChange = vi.fn();
    render(<AmountField value="10" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '20' } });
    expect(onChange).toHaveBeenCalled();
  });
});
