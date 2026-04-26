import { render, screen, fireEvent } from '@testing-library/react';
import CategorySelect from '../../src/components/CategorySelect.jsx';

describe('CategorySelect', () => {
  test('should render "Select category" placeholder when includeAll is false', () => {
    // Arrange + Act
    render(<CategorySelect value="" onChange={jest.fn()} />);
    // Assert
    expect(screen.getByRole('option', { name: 'Select category' })).toBeInTheDocument();
  });

  test('should render "All categories" placeholder when includeAll is true', () => {
    // Arrange + Act
    render(<CategorySelect value="" onChange={jest.fn()} includeAll />);
    // Assert
    expect(screen.getByRole('option', { name: 'All categories' })).toBeInTheDocument();
  });

  test('should render all 7 expense categories', () => {
    // Arrange + Act
    render(<CategorySelect value="" onChange={jest.fn()} />);
    // Assert
    ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'].forEach((cat) => {
      expect(screen.getByRole('option', { name: cat })).toBeInTheDocument();
    });
  });

  test('should have 8 options total (7 categories + default) when includeAll is false', () => {
    // Arrange + Act
    render(<CategorySelect value="" onChange={jest.fn()} />);
    // Assert
    expect(screen.getAllByRole('option')).toHaveLength(8);
  });

  test('should fire onChange when user selects an option', () => {
    // Arrange
    const onChange = jest.fn();
    render(<CategorySelect value="" onChange={onChange} />);
    // Act
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Fuel' } });
    // Assert
    expect(onChange).toHaveBeenCalled();
  });

  test('should accept a custom name attribute', () => {
    // Arrange + Act
    render(<CategorySelect value="" onChange={jest.fn()} name="myCategory" />);
    // Assert
    expect(screen.getByRole('combobox')).toHaveAttribute('name', 'myCategory');
  });
});
