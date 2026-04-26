import { render, screen, fireEvent } from '@testing-library/react';
import FuelFields from '../../src/components/FuelFields.jsx';

describe('FuelFields', () => {
  test('should render litres and price_per_litre inputs with provided values', () => {
    // Arrange + Act
    const { container } = render(<FuelFields litres="40" pricePerLitre="5.5" onChange={jest.fn()} />);
    // Assert
    expect(container.querySelector('input[name="litres"]')).toHaveValue(40);
    expect(container.querySelector('input[name="price_per_litre"]')).toHaveValue(5.5);
  });

  test('should not show computed amount when litres is empty', () => {
    // Arrange + Act
    const { container } = render(<FuelFields litres="" pricePerLitre="5.5" onChange={jest.fn()} />);
    // Assert — "Computed amount" label should not appear
    expect(container.textContent).not.toContain('Computed amount');
  });

  test('should not show computed amount when pricePerLitre is 0', () => {
    // Arrange + Act
    const { container } = render(<FuelFields litres="40" pricePerLitre="0" onChange={jest.fn()} />);
    // Assert
    expect(container.textContent).not.toContain('Computed amount');
  });

  test('should show correct computed amount when both fields have positive values', () => {
    // Arrange + Act
    render(<FuelFields litres="40" pricePerLitre="5.50" onChange={jest.fn()} />);
    // Assert: 40 * 5.50 = 220.00
    expect(screen.getByText('220.00')).toBeInTheDocument();
  });

  test('should round computed amount to 2 decimal places', () => {
    // Arrange + Act
    render(<FuelFields litres="33.333" pricePerLitre="1" onChange={jest.fn()} />);
    // Assert: Math.round(33.333 * 1 * 100) / 100 = 33.33
    expect(screen.getByText('33.33')).toBeInTheDocument();
  });

  test('should fire onChange when litres input changes', () => {
    // Arrange
    const onChange = jest.fn();
    const { container } = render(<FuelFields litres="" pricePerLitre="" onChange={onChange} />);
    // Act
    fireEvent.change(container.querySelector('input[name="litres"]'), { target: { value: '5' } });
    // Assert
    expect(onChange).toHaveBeenCalled();
  });

  test('should fire onChange when price_per_litre input changes', () => {
    // Arrange
    const onChange = jest.fn();
    const { container } = render(<FuelFields litres="" pricePerLitre="" onChange={onChange} />);
    // Act
    fireEvent.change(container.querySelector('input[name="price_per_litre"]'), { target: { value: '5.5' } });
    // Assert
    expect(onChange).toHaveBeenCalled();
  });
});
