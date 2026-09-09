import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
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
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
vi.mock('@/utils/formatDate.js', () => ({
  formatDate: (d) => d,
  currentYear: () => 2026,
  todayISO: () => '2026-09-03',
  getMonthName: (m) => MONTH_NAMES[m - 1],
}));
vi.mock('@/utils/formatCurrency.js', () => ({ formatCurrency: (v) => String(v) }));

const mockAuth = vi.fn().mockReturnValue({ currency: 'BRL', plan: 'pro', targetHourlyRate: null });
vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth(),
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

  it('submits tips alongside km/deliveries in shift mode', async () => {
    await openNewIncomeForm();
    fireEvent.change(screen.getByLabelText('income.fields.amount'), {
      target: { value: '200' },
    });
    fireEvent.change(screen.getByLabelText('income.fields.tips'), {
      target: { value: '20' },
    });
    fireEvent.click(screen.getByText('common.save'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ tips: 20 }));
    });
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

describe('IncomeListPage — year/month filters', () => {
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
  });

  it('fetches the current year with breakdown=monthly on mount', async () => {
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(mockList).toHaveBeenCalledWith({ year: '2026', month: undefined }, expect.anything());
    expect(mockSummary).toHaveBeenCalledWith(
      { year: '2026', month: undefined, breakdown: 'monthly' },
      expect.anything(),
    );
  });

  it('refetches with the picked month and drops breakdown', async () => {
    await act(async () => {
      render(<IncomeListPage />);
    });
    vi.clearAllMocks();
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

    await act(async () => {
      fireEvent.change(screen.getByLabelText('income.filters.month'), {
        target: { name: 'month', value: '3' },
      });
    });

    expect(mockList).toHaveBeenCalledWith({ year: '2026', month: '3' }, expect.anything());
    expect(mockSummary).toHaveBeenCalledWith(
      { year: '2026', month: '3', breakdown: undefined },
      expect.anything(),
    );
  });
});

describe('IncomeListPage — month breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLang.mockReturnValue('en');
    mockList.mockResolvedValue([]);
    mockVehiclesList.mockResolvedValue([]);
  });

  it('renders the breakdown section only when months data is present and no month is selected', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
      months: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        totalIncome: i === 2 ? 500 : 0,
        fuelCost: i === 2 ? 50 : null,
        netEarnings: i === 2 ? 450 : null,
        netPerHour: i === 2 ? 45 : null,
        hours: i === 2 ? 10 : null,
        workKm: i === 2 ? 100 : null,
      })),
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    const breakdown = within(screen.getByTestId('income-month-breakdown'));
    expect(breakdown.getByText('March')).toBeInTheDocument();
  });

  it('renders a shorter breakdown when the backend returns fewer than 12 months (clamped window)', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
      months: [
        {
          month: 9,
          totalIncome: 500,
          fuelCost: 50,
          netEarnings: 450,
          netPerHour: 45,
          hours: 10,
          workKm: 100,
        },
      ],
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    const breakdown = within(screen.getByTestId('income-month-breakdown'));
    expect(breakdown.getByText('September')).toBeInTheDocument();
    expect(breakdown.queryByText('January')).not.toBeInTheDocument();
  });

  it('hides the breakdown section once a month is selected', async () => {
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
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.queryByTestId('income-month-breakdown')).not.toBeInTheDocument();
  });

  it('shows a suspect warning when costPerKmFlags is non-empty', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 3464.87,
      fuelCost: 87.41,
      netEarnings: 3377.46,
      netPerHour: 214.17,
      hours: 15.77,
      workKm: 279.1,
      costPerKm: 0.31,
      costPerKmSamples: 1,
      costPerKmSpanKm: 1488,
      costPerKmFlags: ['impliedRangeTooHigh'],
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.costPerKmSuspect')).toBeInTheDocument();
  });

  it('shows the missingOdometer-specific warning when flag details are present', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 4188.5,
      fuelCost: 640.39,
      netEarnings: 3548.11,
      netPerHour: 166.58,
      hours: 21.3,
      workKm: 355.2,
      costPerKm: 1.8,
      costPerKmSamples: 3,
      costPerKmSpanKm: 416,
      costPerKmFlags: ['missingOdometer'],
      costPerKmFlagDetails: [
        { flag: 'missingOdometer', count: 1, date: '2026-08-28', lastDate: '2026-08-28' },
      ],
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.costPerKmSuspectMissingOdometer')).toBeInTheDocument();
    expect(screen.queryByText('income.summary.costPerKmSuspect')).not.toBeInTheDocument();
  });

  it('shows the impliedRangeTooHigh-specific warning when flag details are present', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 3464.87,
      fuelCost: 87.41,
      netEarnings: 3377.46,
      netPerHour: 214.17,
      hours: 15.77,
      workKm: 279.1,
      costPerKm: 0.31,
      costPerKmSamples: 1,
      costPerKmSpanKm: 1488,
      costPerKmFlags: ['impliedRangeTooHigh'],
      costPerKmFlagDetails: [
        {
          flag: 'impliedRangeTooHigh',
          startDate: '2026-08-01',
          endDate: '2026-09-03',
          spanKm: 1488,
          litres: 5,
        },
      ],
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.costPerKmSuspectImpliedRange')).toBeInTheDocument();
    expect(screen.queryByText('income.summary.costPerKmSuspect')).not.toBeInTheDocument();
  });

  it('does not show the suspect warning when costPerKmFlags is empty', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
      costPerKmSpanKm: 200,
      costPerKmFlags: [],
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.queryByText('income.summary.costPerKmSuspect')).not.toBeInTheDocument();
  });

  it('shows the work-share explainer and the fuel (work) tile label on the main panel', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 4188.5,
      fuelSpend: 640.39,
      fuelCost: 512.31,
      netEarnings: 3676.19,
      netPerHour: 172.6,
      hours: 21.3,
      workKm: 355.2,
      totalKm: 444,
      personalKm: 88.8,
      workShare: 0.8,
      workShareBasis: 'odometerSplit',
      costPerKm: null,
      costPerKmSamples: 0,
      costPerKmFlags: [],
    });
    render(<IncomeListPage />);
    await screen.findByText('income.summary.fuelCostWork');
    expect(screen.getByText('income.summary.fuelCostWork')).toBeInTheDocument();
    expect(screen.getByText('income.summary.fuelExplainerSplit')).toBeInTheDocument();
    expect(screen.getByText('income.summary.howCalculated')).toBeInTheDocument();
    // Work km moved into the details disclosure rather than the top-level tiles.
    expect(screen.getByText('income.summary.workKm')).toBeInTheDocument();
  });

  it('shows the no-split explainer when workShare is null', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 394.37,
      fuelSpend: 471.62,
      fuelCost: 471.62,
      netEarnings: -77.25,
      netPerHour: null,
      hours: 2.95,
      workKm: 41,
      totalKm: null,
      personalKm: null,
      workShare: null,
      workShareBasis: 'noOdometerData',
      costPerKm: null,
      costPerKmSamples: 0,
      costPerKmFlags: [],
    });
    render(<IncomeListPage />);
    expect(await screen.findByText('income.summary.fuelExplainerNoSplit')).toBeInTheDocument();
  });
});

describe('IncomeListPage — profit verdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLang.mockReturnValue('en');
    mockList.mockResolvedValue([]);
    mockVehiclesList.mockResolvedValue([]);
    mockAuth.mockReturnValue({ currency: 'BRL', plan: 'pro', targetHourlyRate: null });
  });

  it('shows the "no" verdict when net earnings are negative, with no target set', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 100,
      fuelCost: 150,
      netEarnings: -50,
      netPerHour: -5,
      hours: 10,
      workKm: 100,
      costPerKm: 1.5,
      costPerKmSamples: 3,
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.verdict.no')).toBeInTheDocument();
  });

  it('shows the plain "yes" verdict when net earnings are positive and no target is set', async () => {
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.verdict.yes')).toBeInTheDocument();
  });

  it('shows the "barely" verdict when net/h is positive but below the target rate', async () => {
    mockAuth.mockReturnValue({ currency: 'BRL', plan: 'pro', targetHourlyRate: 60 });
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.verdict.barely')).toBeInTheDocument();
  });

  it('shows the "yes vs target" verdict when net/h meets or beats the target rate', async () => {
    mockAuth.mockReturnValue({ currency: 'BRL', plan: 'pro', targetHourlyRate: 30 });
    mockSummary.mockResolvedValue({
      totalIncome: 500,
      fuelCost: 50,
      netEarnings: 450,
      netPerHour: 45,
      hours: 10,
      workKm: 100,
      costPerKm: 0.5,
      costPerKmSamples: 3,
    });
    await act(async () => {
      render(<IncomeListPage />);
    });
    expect(screen.getByText('income.summary.verdict.yesVsTarget')).toBeInTheDocument();
  });
});
