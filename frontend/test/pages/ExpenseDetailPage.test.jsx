import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExpenseDetailPage from '../../src/pages/ExpenseDetailPage.jsx';
import { expensesApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  expensesApi: {
    get: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const sampleExpense = {
  id: '42',
  date: '2026-04-15T00:00:00.000Z',
  category: 'Maintenance',
  amount: 150.0,
  litres: null,
  price_per_litre: null,
};

function renderDetailPage(id = '42') {
  return render(
    <MemoryRouter initialEntries={[`/expenses/${id}`]}>
      <Routes>
        <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
        <Route path="/expenses" element={<div>Expenses list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExpenseDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch and display the expense on mount', async () => {
    // Arrange
    expensesApi.get.mockResolvedValue(sampleExpense);
    // Act
    renderDetailPage();
    // Assert
    await waitFor(() => {
      expect(expensesApi.get).toHaveBeenCalledWith('42');
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('150.00')).toBeInTheDocument();
    });
  });

  test('should display error banner when fetch fails', async () => {
    // Arrange
    expensesApi.get.mockRejectedValue(new Error('Expense not found'));
    // Act
    renderDetailPage();
    // Assert
    await screen.findByText('Expense not found');
  });

  test('should call expensesApi.remove and navigate to /expenses when delete is confirmed', async () => {
    // Arrange
    expensesApi.get.mockResolvedValue(sampleExpense);
    expensesApi.remove.mockResolvedValue(null);
    window.confirm = jest.fn(() => true);
    renderDetailPage();
    await screen.findByText('Maintenance');
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    // Assert
    await waitFor(() => {
      expect(expensesApi.remove).toHaveBeenCalledWith('42');
      expect(mockNavigate).toHaveBeenCalledWith('/expenses');
    });
  });

  test('should not call expensesApi.remove when delete is cancelled', async () => {
    // Arrange
    expensesApi.get.mockResolvedValue(sampleExpense);
    window.confirm = jest.fn(() => false);
    renderDetailPage();
    await screen.findByText('Maintenance');
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    // Assert
    expect(expensesApi.remove).not.toHaveBeenCalled();
  });
});
