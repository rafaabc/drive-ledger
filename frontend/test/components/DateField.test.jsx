import { render, screen, fireEvent } from '@testing-library/react';
import DateField from '../../src/components/DateField.jsx';

describe('DateField', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('should render a date input with the provided value', () => {
    // Arrange + Act
    const { container } = render(<DateField value="2026-04-15" onChange={jest.fn()} />);
    // Assert
    expect(container.querySelector('input[type="date"]')).toHaveValue('2026-04-15');
  });

  test('should set max attribute to today ISO date', () => {
    // Arrange + Act
    const { container } = render(<DateField value="" onChange={jest.fn()} />);
    // Assert
    expect(container.querySelector('input[type="date"]')).toHaveAttribute('max', '2026-04-26');
  });

  test('should use custom name attribute', () => {
    // Arrange + Act
    const { container } = render(<DateField value="" onChange={jest.fn()} name="expiryDate" />);
    // Assert
    expect(container.querySelector('input[type="date"]')).toHaveAttribute('name', 'expiryDate');
  });

  test('should default to "date" as the name attribute', () => {
    // Arrange + Act
    const { container } = render(<DateField value="" onChange={jest.fn()} />);
    // Assert
    expect(container.querySelector('input[type="date"]')).toHaveAttribute('name', 'date');
  });

  test('should fire onChange when value changes', () => {
    // Arrange
    const onChange = jest.fn();
    const { container } = render(<DateField value="2026-04-15" onChange={onChange} />);
    // Act
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-04-20' } });
    // Assert
    expect(onChange).toHaveBeenCalled();
  });
});
