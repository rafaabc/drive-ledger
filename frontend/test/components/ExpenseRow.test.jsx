import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseRow from '../../src/components/ExpenseRow.jsx';
import { expensesApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  expensesApi: { remove: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const fuelExpense = {
  id: '1',
  date: '2026-04-15T00:00:00.000Z',
  category: 'Fuel',
  amount: 220.0,
  litres: 40,
  price_per_litre: 5.5,
};

const nonFuelExpense = {
  id: '2',
  date: '2026-03-10T00:00:00.000Z',
  category: 'Maintenance',
  amount: 150.0,
  litres: null,
  price_per_litre: null,
};

function renderRow(expense, onDeleted = jest.fn(), onError = jest.fn()) {
  return {
    onDeleted,
    onError,
    ...render(
      <MemoryRouter future={{ v7_relativeSplatPath: true }}>
        <table>
          <tbody>
            <ExpenseRow expense={expense} onDeleted={onDeleted} onError={onError} />
          </tbody>
        </table>
      </MemoryRouter>
    ),
  };
}

describe('ExpenseRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    expensesApi.remove.mockResolvedValue(null);
  });

  test('should render category and amount for a fuel expense', () => {
    // Arrange + Act
    renderRow(fuelExpense);
    // Assert
    expect(screen.getByText('Fuel')).toBeInTheDocument();
    expect(screen.getByText('220.00')).toBeInTheDocument();
  });

  test('should render a dash placeholder when description is absent', () => {
    // Arrange + Act
    renderRow(nonFuelExpense);
    // Assert — nonFuelExpense has no description, so the placeholder dash appears
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('should render description text when present', () => {
    // Arrange
    const expenseWithDesc = { ...fuelExpense, description: 'Full tank' };
    // Act
    renderRow(expenseWithDesc);
    // Assert
    expect(screen.getByText('Full tank')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  test('should call expensesApi.remove and onDeleted when delete is confirmed', async () => {
    // Arrange
    const onDeleted = jest.fn();
    window.confirm = jest.fn(() => true);
    renderRow(fuelExpense, onDeleted);
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    // Assert
    expect(expensesApi.remove).toHaveBeenCalledWith('1');
    expect(onDeleted).toHaveBeenCalledWith('1');
  });

  test('should not call API or onDeleted when delete is cancelled', async () => {
    // Arrange
    const onDeleted = jest.fn();
    window.confirm = jest.fn(() => false);
    renderRow(fuelExpense, onDeleted);
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    // Assert
    expect(expensesApi.remove).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  test('should navigate to the expense edit page when Edit is clicked', () => {
    // Arrange
    renderRow(fuelExpense);
    // Act
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    // Assert
    expect(mockNavigate).toHaveBeenCalledWith('/expenses/1/edit');
  });
});
