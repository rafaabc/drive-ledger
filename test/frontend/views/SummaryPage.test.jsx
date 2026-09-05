import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import SummaryPage from '@/views/SummaryPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));
vi.mock('@/views/SummaryPage.module.css', () => ({ default: {} }));
vi.mock('@/components/Loading.jsx', () => ({ default: () => <div data-testid="loading" /> }));
vi.mock('@/components/CategorySelect.jsx', () => ({
  default: ({ value, onChange, id }) => (
    <select id={id} name="category" value={value} onChange={onChange}>
      <option value="">All</option>
      <option value="Fuel">Fuel</option>
    </select>
  ),
}));
vi.mock('@/components/charts/StackedMonthlyBar.jsx', () => ({
  default: () => <svg data-testid="bar-chart" />,
}));
vi.mock('@/components/charts/CategoryDonut.jsx', () => ({
  default: () => <svg data-testid="donut-chart" />,
}));
vi.mock('@/utils/formatDate.js', () => ({ currentYear: () => 2026 }));
vi.mock('@/utils/formatCurrency.js', () => ({ formatCurrency: (v) => String(v) }));
vi.mock('@/i18n/index.js', () => ({ default: { language: 'en' } }));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({ currency: 'BRL' }),
}));

const mockList = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  expensesApi: { list: () => mockList() },
}));

const expenses = [
  { id: 'e1', date: '2026-01-15', category: 'Fuel', amount: 200 },
  { id: 'e2', date: '2026-02-10', category: 'Maintenance', amount: 300 },
];

describe('SummaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(expenses);
  });

  it('should render summary heading', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getByText('summary.heading')).toBeInTheDocument();
  });

  it('should render year input and category select', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getByLabelText(/summary\.year/)).toBeInTheDocument();
    expect(screen.getByLabelText('summary.category')).toBeInTheDocument();
  });

  it('should render pivot table with month rows when data loaded', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getAllByText('summary.total').length).toBeGreaterThan(0);
  });

  it('should show empty message when no data', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getByText('summary.noData')).toBeInTheDocument();
  });

  it('should show error banner when fetch fails', async () => {
    mockList.mockRejectedValue(new Error('api down'));
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('api down');
  });

  it('should reload when year filter changes', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(mockList).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/summary\.year/), {
        target: { value: '2025', name: 'year' },
      });
    });
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('should render charts when data present', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
  });

  it('should render mobile month breakdown with all 12 months and correct totals', async () => {
    await act(async () => {
      render(<SummaryPage />);
    });
    const mobile = within(screen.getByTestId('mobile-month-breakdown'));
    expect(mobile.getByText(/summary\.breakdown/)).toBeInTheDocument();
    // 2 months with data (Jan, Feb) rendered as expandable <details>, 10 empty
    expect(mobile.getAllByText('200').length).toBeGreaterThan(0);
    expect(mobile.getAllByText('300').length).toBeGreaterThan(0);
    expect(mobile.getAllByText('—')).toHaveLength(10);
    // grand total footer within this section
    expect(mobile.getByText(/summary\.total 2026/)).toBeInTheDocument();
    expect(mobile.getAllByText('500')).toHaveLength(1);
  });
});
