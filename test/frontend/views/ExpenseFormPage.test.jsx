import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExpenseFormPage from '@/views/ExpenseFormPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/views/ExpenseFormPage.module.css', () => ({ default: {} }));
vi.mock('@/components/Loading.jsx', () => ({ default: () => <div data-testid="loading" /> }));
vi.mock('@/components/CategorySelect.jsx', () => ({
  default: ({ value, onChange, id }) => (
    <select id={id} name="category" value={value} onChange={onChange}>
      <option value="">Select</option>
      <option value="Fuel">Fuel</option>
      <option value="Maintenance">Maintenance</option>
    </select>
  ),
}));
vi.mock('@/components/DateField.jsx', () => ({
  default: ({ value, onChange, id }) => (
    <input type="date" id={id} name="date" value={value} onChange={onChange} />
  ),
}));
vi.mock('@/components/FuelFields.jsx', () => ({
  default: ({ litres, pricePerLitre, odometer, onChange }) => (
    <>
      <input name="litres" value={litres} onChange={onChange} data-testid="litres" />
      <input name="price_per_litre" value={pricePerLitre} onChange={onChange} data-testid="ppl" />
      <input name="odometer" value={odometer} onChange={onChange} data-testid="odometer" />
    </>
  ),
}));
vi.mock('@/components/AmountField.jsx', () => ({
  default: ({ value, onChange }) => (
    <input name="amount" type="number" value={value} onChange={onChange} data-testid="amount" />
  ),
}));
vi.mock('@/utils/formatDate.js', () => ({ todayISO: () => '2026-05-20' }));

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockUseRouter = vi.fn();
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  useParams: () => mockUseParams(),
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockVehiclesList = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  expensesApi: {
    create: () => mockCreate(),
    update: (...a) => mockUpdate(...a),
    get: (id) => mockGet(id),
  },
  vehiclesApi: {
    list: () => mockVehiclesList(),
  },
}));

describe('ExpenseFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush, back: mockBack });
    mockUseParams.mockReturnValue({});
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockVehiclesList.mockResolvedValue([]);
  });

  it('should render create heading when no id', () => {
    render(<ExpenseFormPage />);
    expect(screen.getByText('expenses.newExpense')).toBeInTheDocument();
  });

  it('should render date and category fields', () => {
    render(<ExpenseFormPage />);
    expect(document.querySelector('[name="date"]')).toBeInTheDocument();
    expect(document.querySelector('[name="category"]')).toBeInTheDocument();
  });

  it('should show AmountField for non-fuel category', () => {
    render(<ExpenseFormPage />);
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Maintenance', name: 'category' },
    });
    expect(screen.getByTestId('amount')).toBeInTheDocument();
  });

  it('should show FuelFields for Fuel category', () => {
    render(<ExpenseFormPage />);
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Fuel', name: 'category' },
    });
    expect(screen.getByTestId('litres')).toBeInTheDocument();
    expect(screen.getByTestId('ppl')).toBeInTheDocument();
  });

  it('should call create and navigate to /expenses on non-fuel submit', async () => {
    render(<ExpenseFormPage />);
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Maintenance', name: 'category' },
    });
    fireEvent.change(screen.getByTestId('amount'), { target: { value: '100', name: 'amount' } });
    await act(async () => {
      fireEvent.submit(document.querySelector('form'));
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/expenses');
  });

  it('should call create with fuel payload on Fuel submit', async () => {
    render(<ExpenseFormPage />);
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Fuel', name: 'category' },
    });
    fireEvent.change(screen.getByTestId('litres'), { target: { value: '40', name: 'litres' } });
    fireEvent.change(screen.getByTestId('ppl'), {
      target: { value: '5.5', name: 'price_per_litre' },
    });
    await act(async () => {
      fireEvent.submit(document.querySelector('form'));
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/expenses');
  });

  it('should show error banner when create fails', async () => {
    mockCreate.mockRejectedValue(new Error('bad request'));
    render(<ExpenseFormPage />);
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Maintenance', name: 'category' },
    });
    await act(async () => {
      fireEvent.submit(document.querySelector('form'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('bad request');
  });

  it('should call router.back when cancel clicked', () => {
    render(<ExpenseFormPage />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(mockBack).toHaveBeenCalledOnce();
  });

  it('should load existing expense in edit mode', async () => {
    mockUseParams.mockReturnValue({ id: 'e1' });
    mockGet.mockResolvedValue({
      date: '2026-05-10T00:00:00.000Z',
      category: 'Maintenance',
      amount: 200,
      litres: null,
      price_per_litre: null,
      odometer: null,
    });
    await act(async () => {
      render(<ExpenseFormPage />);
    });
    expect(screen.getByText('expenses.editExpense')).toBeInTheDocument();
  });

  it('should show loading spinner while fetching edit data', () => {
    mockUseParams.mockReturnValue({ id: 'e1' });
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ExpenseFormPage />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
