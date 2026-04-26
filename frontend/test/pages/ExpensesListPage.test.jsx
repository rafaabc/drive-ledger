import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpensesListPage from '../../src/pages/ExpensesListPage.jsx';
import { expensesApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  expensesApi: {
    list: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  return render(<MemoryRouter><ExpensesListPage /></MemoryRouter>);
}

describe('ExpensesListPage', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    expensesApi.remove.mockResolvedValue(null);
  });

  test('should call expensesApi.list on mount with default filters', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    // Act
    renderPage();
    // Assert
    await waitFor(() => {
      expect(expensesApi.list).toHaveBeenCalledWith({ category: '', year: '2026', month: '' });
    });
  });

  test('should render expenses sorted by date descending', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([
      { id: '1', date: '2026-01-01', category: 'Parking', amount: 10 },
      { id: '2', date: '2026-03-15', category: 'Fuel', amount: 220, litres: 40, price_per_litre: 5.5 },
      { id: '3', date: '2026-02-10', category: 'Maintenance', amount: 30 },
    ]);
    // Act
    renderPage();
    // Assert
    const badges = await waitFor(() => {
      const b = document.querySelectorAll('[data-cat]');
      expect(b).toHaveLength(3);
      return b;
    });
    expect(badges[0]).toHaveAttribute('data-cat', 'Fuel');
    expect(badges[1]).toHaveAttribute('data-cat', 'Maintenance');
    expect(badges[2]).toHaveAttribute('data-cat', 'Parking');
  });

  test('should show "No expenses found." when API returns empty array', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    // Act
    renderPage();
    // Assert
    await screen.findByText('No expenses found.');
  });

  test('should show error banner when API rejects', async () => {
    // Arrange
    expensesApi.list.mockRejectedValue(new Error('Network error'));
    // Act
    renderPage();
    // Assert
    await screen.findByText('Network error');
  });

  test('should not re-fetch when year filter is set to an invalid value', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    const { container } = renderPage();
    await waitFor(() => expect(expensesApi.list).toHaveBeenCalledTimes(1));
    // Act — set an invalid year (only 2 digits)
    await act(async () => {
      fireEvent.change(container.querySelector('input[name="year"]'), { target: { value: '19' } });
    });
    // Assert — still only one call
    expect(expensesApi.list).toHaveBeenCalledTimes(1);
  });

  test('should re-fetch with updated filters when a valid filter changes', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    const { container } = renderPage();
    await waitFor(() => expect(expensesApi.list).toHaveBeenCalledTimes(1));
    // Act — change category filter
    await act(async () => {
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Fuel' } });
    });
    // Assert
    await waitFor(() => {
      expect(expensesApi.list).toHaveBeenCalledWith(expect.objectContaining({ category: 'Fuel' }));
    });
  });

  test('should reset filters to defaults when Clear button is clicked', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    const { container } = renderPage();
    await waitFor(() => expect(expensesApi.list).toHaveBeenCalledTimes(1));
    fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Fuel' } });
    await waitFor(() => expect(expensesApi.list).toHaveBeenCalledTimes(2));
    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    });
    // Assert
    await waitFor(() => {
      const lastCall = expensesApi.list.mock.calls.at(-1)[0];
      expect(lastCall).toEqual({ category: '', year: '2026', month: '' });
    });
  });

  test('should navigate to /expenses/new when "+ New expense" button is clicked', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    renderPage();
    await screen.findByText('No expenses found.');
    // Act
    fireEvent.click(screen.getByRole('button', { name: /new expense/i }));
    // Assert
    expect(mockNavigate).toHaveBeenCalledWith('/expenses/new');
  });
});
