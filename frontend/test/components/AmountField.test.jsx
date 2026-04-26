import { render, screen, fireEvent } from '@testing-library/react';
import AmountField from '../../src/components/AmountField.jsx';

describe('AmountField', () => {
  test('should render number input with the provided value', () => {
    // Arrange + Act
    const { container } = render(<AmountField value="150.00" onChange={jest.fn()} />);
    // Assert
    expect(container.querySelector('input[name="amount"]')).toHaveValue(150);
  });

  test('should fire onChange when the user types a value', () => {
    // Arrange
    const onChange = jest.fn();
    const { container } = render(<AmountField value="" onChange={onChange} />);
    // Act
    fireEvent.change(container.querySelector('input[name="amount"]'), { target: { value: '50' } });
    // Assert
    expect(onChange).toHaveBeenCalled();
  });

  test('should have the correct HTML attributes', () => {
    // Arrange + Act
    const { container } = render(<AmountField value="0" onChange={jest.fn()} />);
    const input = container.querySelector('input[name="amount"]');
    // Assert
    expect(input).toHaveAttribute('min', '0.01');
    expect(input).toHaveAttribute('step', '0.01');
    expect(input).toBeRequired();
  });
});
