import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SummaryPage from '../../src/pages/SummaryPage.jsx';
import { expensesApi } from '../../src/services/apiService.js';

jest.mock('../../src/services/apiService.js', () => ({
  expensesApi: { list: jest.fn() },
}));

const expenses = [
  { id: '1', date: '2026-01-15', category: 'Fuel', amount: 100.0, litres: 20, price_per_litre: 5 },
  { id: '2', date: '2026-01-20', category: 'Parking', amount: 10.0 },
  { id: '3', date: '2026-03-05', category: 'Fuel', amount: 50.0, litres: 10, price_per_litre: 5 },
];

function renderPage() {
  return render(<MemoryRouter><SummaryPage /></MemoryRouter>);
}

describe('SummaryPage', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call expensesApi.list on mount with the current year', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    // Act
    renderPage();
    // Assert
    await waitFor(() => {
      expect(expensesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ year: '2026' })
      );
    });
  });

  test('should show "No expenses found" message when list is empty', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    // Act
    renderPage();
    // Assert
    await screen.findByText(/no expenses found for 2026/i);
  });

  test('should render a pivot table with correct column and row totals', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue(expenses);
    // Act
    renderPage();
    // Assert — Fuel column total is 150.00 (100 + 50)
    await screen.findByText('150.00');
    // Parking column total is 10.00 (appears in row and footer)
    expect(screen.getAllByText('10.00').length).toBeGreaterThanOrEqual(1);
    // January row total is 110.00 (100 + 10)
    expect(screen.getByText('110.00')).toBeInTheDocument();
    // March row total is 50.00 (also appears in Fuel/March cell and footer)
    expect(screen.getAllByText('50.00').length).toBeGreaterThanOrEqual(1);
  });

  test('should not fetch when year has fewer than 4 digits', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue([]);
    const { container } = renderPage();
    await waitFor(() => expect(expensesApi.list).toHaveBeenCalledTimes(1));
    // Act
    await act(async () => {
      fireEvent.change(container.querySelector('input[name="year"]'), { target: { value: '20' } });
    });
    // Assert
    expect(expensesApi.list).toHaveBeenCalledTimes(1);
  });

  test('should show only the selected category column when a category filter is applied', async () => {
    // Arrange
    expensesApi.list.mockResolvedValue(expenses);
    const { container } = renderPage();
    await screen.findByText('150.00');
    // Act — filter by Fuel only
    expensesApi.list.mockResolvedValue(
      expenses.filter((e) => e.category === 'Fuel')
    );
    await act(async () => {
      fireEvent.change(container.querySelector('select[name="category"]'), { target: { value: 'Fuel' } });
    });
    // Assert — only Fuel column header present (no Parking)
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Parking');
    });
  });
});
