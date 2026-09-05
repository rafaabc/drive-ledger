import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import IncomeListPage from '@/views/IncomeListPage';

const mockLang = vi.fn().mockReturnValue('en');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k) => k,
    i18n: {
      get language() {
        return mockLang();
      },
    },
  }),
}));
vi.mock('@/i18n/index.js', () => ({
  default: { t: (k) => k, changeLanguage: vi.fn(), language: 'en' },
}));
vi.mock('@/utils/formatDate.js', () => ({
  formatDate: (d) => d,
  currentYear: () => 2026,
  todayISO: () => '2026-09-03',
}));
vi.mock('@/utils/formatCurrency.js', () => ({ formatCurrency: (v) => String(v) }));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({ currency: 'BRL', plan: 'pro' }),
}));

const mockList = vi.fn();
const mockSummary = vi.fn();
const mockCreate = vi.fn();
const mockVehiclesList = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  incomeApi: {
    list: (...args) => mockList(...args),
    summary: (...args) => mockSummary(...args),
    create: (...args) => mockCreate(...args),
    update: vi.fn(),
    remove: vi.fn(),
  },
  vehiclesApi: { list: (...args) => mockVehiclesList(...args) },
}));

describe('IncomeListPage — shift time blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLang.mockReturnValue('en');
    mockList.mockResolvedValue([]);
    mockSummary.mockResolvedValue({
      totalIncome: 0,
      fuelCost: null,
      netEarnings: null,
      netPerHour: null,
      hours: null,
      workKm: null,
      costPerKm: null,
      costPerKmSamples: 0,
    });
    mockVehiclesList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({});
    try {
      window.localStorage.clear();
    } catch {
      /* not available in this environment */
    }
  });

  async function openNewIncomeForm() {
    await act(async () => {
      render(<IncomeListPage />);
    });
    fireEvent.click(screen.getByText(/common\.new/));
    fireEvent.click(screen.getByLabelText('income.fields.shiftMode'));
  }

  it('starts shift mode with a single blank time block', async () => {
    await openNewIncomeForm();
    expect(screen.getAllByLabelText('income.fields.startTime')).toHaveLength(1);
    expect(screen.queryByLabelText('income.fields.removeBlock')).not.toBeInTheDocument();
  });

  it('adds a second time block and sums the total duration', async () => {
    await openNewIncomeForm();

    fireEvent.change(screen.getAllByLabelText('income.fields.startTime')[0], {
      target: { value: '12:00' },
    });
    fireEvent.change(screen.getAllByLabelText('income.fields.endTime')[0], {
      target: { value: '13:00' },
    });

    fireEvent.click(screen.getByText(/income\.fields\.addBlock/));
    expect(screen.getAllByLabelText('income.fields.startTime')).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText('income.fields.startTime')[1], {
      target: { value: '15:30' },
    });
    fireEvent.change(screen.getAllByLabelText('income.fields.endTime')[1], {
      target: { value: '16:40' },
    });

    expect(screen.getByText('2h10')).toBeInTheDocument();
  });

  it('removes a time block', async () => {
    await openNewIncomeForm();
    fireEvent.click(screen.getByText(/income\.fields\.addBlock/));
    expect(screen.getAllByLabelText('income.fields.startTime')).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText('income.fields.removeBlock')[0]);
    expect(screen.getAllByLabelText('income.fields.startTime')).toHaveLength(1);
    expect(screen.queryByLabelText('income.fields.removeBlock')).not.toBeInTheDocument();
  });

  it('submits segments (not startTime/endTime) for a multi-block shift', async () => {
    await openNewIncomeForm();

    fireEvent.change(screen.getByLabelText('income.fields.amount'), { target: { value: '84.2' } });
    fireEvent.change(screen.getAllByLabelText('income.fields.startTime')[0], {
      target: { value: '12:00' },
    });
    fireEvent.change(screen.getAllByLabelText('income.fields.endTime')[0], {
      target: { value: '13:00' },
    });
    fireEvent.click(screen.getByText(/income\.fields\.addBlock/));
    fireEvent.change(screen.getAllByLabelText('income.fields.startTime')[1], {
      target: { value: '15:30' },
    });
    fireEvent.change(screen.getAllByLabelText('income.fields.endTime')[1], {
      target: { value: '16:40' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('common.save'));
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        segments: [
          { startTime: '12:00', endTime: '13:00' },
          { startTime: '15:30', endTime: '16:40' },
        ],
      }),
    );
    const submitted = mockCreate.mock.calls[0][0];
    expect(submitted.startTime).toBeUndefined();
    expect(submitted.endTime).toBeUndefined();
  });
});

describe('IncomeListPage — decimal separator regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLang.mockReturnValue('en');
    mockList.mockResolvedValue([]);
    mockSummary.mockResolvedValue({
      totalIncome: 0,
      fuelCost: null,
      netEarnings: null,
      netPerHour: null,
      hours: null,
      workKm: null,
      costPerKm: null,
      costPerKmSamples: 0,
    });
    mockVehiclesList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({});
  });

  async function openNewIncomeForm() {
    await act(async () => {
      render(<IncomeListPage />);
    });
    fireEvent.click(screen.getByText(/common\.new/));
  }

  it('sends a comma-decimal amount as a well-formed number under pt-BR', async () => {
    mockLang.mockReturnValue('pt-BR');
    await openNewIncomeForm();
    fireEvent.change(screen.getByLabelText('income.fields.amount'), {
      target: { value: '84,2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('common.save'));
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 84.2 }));
  });

  it('sends a period-decimal amount as a well-formed number under en', async () => {
    await openNewIncomeForm();
    fireEvent.change(screen.getByLabelText('income.fields.amount'), {
      target: { value: '84.2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('common.save'));
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 84.2 }));
  });
});
