import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExpenseFormPage from '../../src/pages/ExpenseFormPage.jsx';
import { expensesApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  expensesApi: {
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/expenses/new']}>
      <Routes>
        <Route path="/expenses/new" element={<ExpenseFormPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEditPage(id = '42') {
  return render(
    <MemoryRouter initialEntries={[`/expenses/${id}/edit`]}>
      <Routes>
        <Route path="/expenses/:id/edit" element={<ExpenseFormPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExpenseFormPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create mode', () => {
    test('should not call expensesApi.get on mount in create mode', () => {
      // Arrange + Act
      renderCreatePage();
      // Assert
      expect(expensesApi.get).not.toHaveBeenCalled();
    });

    test('should submit non-Fuel expense with parsed amount', async () => {
      // Arrange
      expensesApi.create.mockResolvedValue({ id: '99' });
      const { container } = renderCreatePage();
      // Act
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Maintenance' } });
      fireEvent.change(container.querySelector('input[name="amount"]'), { target: { value: '150' } });
      fireEvent.submit(container.querySelector('form'));
      // Assert
      await waitFor(() => {
        expect(expensesApi.create).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Maintenance', amount: 150 })
        );
        expect(expensesApi.create.mock.calls[0][0]).not.toHaveProperty('litres');
        expect(mockNavigate).toHaveBeenCalledWith('/expenses');
      });
    });

    test('should submit Fuel expense with litres and price_per_litre (no amount)', async () => {
      // Arrange
      expensesApi.create.mockResolvedValue({ id: '99' });
      const { container } = renderCreatePage();
      // Act
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Fuel' } });
      fireEvent.change(container.querySelector('input[name="litres"]'), { target: { value: '40' } });
      fireEvent.change(container.querySelector('input[name="price_per_litre"]'), { target: { value: '5.5' } });
      fireEvent.submit(container.querySelector('form'));
      // Assert
      await waitFor(() => {
        expect(expensesApi.create).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Fuel', litres: 40, price_per_litre: 5.5 })
        );
        expect(expensesApi.create.mock.calls[0][0]).not.toHaveProperty('amount');
      });
    });

    test('should clear fuel-specific fields when category changes', () => {
      // Arrange
      const { container } = renderCreatePage();
      // Act — select Fuel first
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Fuel' } });
      fireEvent.change(container.querySelector('input[name="litres"]'), { target: { value: '40' } });
      // Act — change to Maintenance
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Maintenance' } });
      // Assert — AmountField is shown, litres input is gone
      expect(container.querySelector('input[name="litres"]')).not.toBeInTheDocument();
      expect(container.querySelector('input[name="amount"]')).toHaveValue(null);
    });

    test('should display error and keep form enabled on API failure', async () => {
      // Arrange
      expensesApi.create.mockRejectedValue(new Error('Server error'));
      const { container } = renderCreatePage();
      // Act
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Parking' } });
      fireEvent.change(container.querySelector('input[name="amount"]'), { target: { value: '20' } });
      fireEvent.submit(container.querySelector('form'));
      // Assert
      await screen.findByText('Server error');
      expect(screen.getByRole('button', { name: /create expense/i })).not.toBeDisabled();
    });
  });

  describe('edit mode', () => {
    test('should call expensesApi.get and populate the form on mount', async () => {
      // Arrange
      expensesApi.get.mockResolvedValue({
        id: '42',
        date: '2026-04-15T00:00:00.000Z',
        category: 'Maintenance',
        amount: 150.0,
        litres: null,
        price_per_litre: null,
      });
      // Act
      renderEditPage('42');
      // Assert
      await waitFor(() => {
        expect(expensesApi.get).toHaveBeenCalledWith('42');
        const categorySelect = screen.getByRole('combobox');
        expect(categorySelect).toHaveValue('Maintenance');
      });
    });

    test('should call expensesApi.update and navigate on success', async () => {
      // Arrange
      expensesApi.get.mockResolvedValue({
        id: '42',
        date: '2026-04-15T00:00:00.000Z',
        category: 'Maintenance',
        amount: 150.0,
        litres: null,
        price_per_litre: null,
      });
      expensesApi.update.mockResolvedValue({});
      const { container } = renderEditPage('42');
      await waitFor(() => expect(expensesApi.get).toHaveBeenCalled());
      // Act
      fireEvent.change(container.querySelector('input[name="amount"]'), { target: { value: '200' } });
      fireEvent.submit(container.querySelector('form'));
      // Assert
      await waitFor(() => {
        expect(expensesApi.update).toHaveBeenCalledWith('42', expect.objectContaining({ amount: 200 }));
        expect(mockNavigate).toHaveBeenCalledWith('/expenses');
      });
    });
  });
});
