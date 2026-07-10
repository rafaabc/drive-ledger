import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecurringFormPage from '@/views/RecurringFormPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/views/RecurringFormPage.module.css', () => ({ default: {} }));
vi.mock('@/components/Loading.jsx', () => ({ default: () => <div data-testid="loading" /> }));
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
  recurringApi: {
    create: (...a) => mockCreate(...a),
    update: (...a) => mockUpdate(...a),
    get: (id) => mockGet(id),
  },
  vehiclesApi: {
    list: () => mockVehiclesList(),
  },
}));

const VEHICLES = [
  { id: 'v1', name: 'Car A' },
  { id: 'v2', name: 'Car B' },
];

describe('RecurringFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush, back: mockBack });
    mockUseParams.mockReturnValue({});
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockVehiclesList.mockResolvedValue([]);
  });

  it('should not show vehicle picker for single-vehicle users', async () => {
    mockVehiclesList.mockResolvedValue([VEHICLES[0]]);
    await act(async () => {
      render(<RecurringFormPage />);
    });
    expect(screen.queryByText('vehicles.selectLabel')).not.toBeInTheDocument();
  });

  it('should show vehicle picker and default to first vehicle for multi-vehicle users', async () => {
    mockVehiclesList.mockResolvedValue(VEHICLES);
    await act(async () => {
      render(<RecurringFormPage />);
    });
    expect(screen.getByText('vehicles.selectLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('vehicles.selectLabel')).toHaveValue('v1');
  });

  it('should include chosen vehicleId in create payload', async () => {
    mockVehiclesList.mockResolvedValue(VEHICLES);
    await act(async () => {
      render(<RecurringFormPage />);
    });
    fireEvent.change(screen.getByLabelText('vehicles.selectLabel'), {
      target: { value: 'v2', name: 'vehicleId' },
    });
    fireEvent.change(document.querySelector('[name="category"]'), {
      target: { value: 'Maintenance', name: 'category' },
    });
    fireEvent.change(screen.getByTestId('amount'), { target: { value: '50', name: 'amount' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'common.save' }).closest('form'));
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'v2' }));
  });

  it('should load existing rule vehicleId in edit mode', async () => {
    mockUseParams.mockReturnValue({ id: 'r1' });
    mockVehiclesList.mockResolvedValue(VEHICLES);
    mockGet.mockResolvedValue({
      category: 'Insurance',
      description: '',
      amount: 100,
      startDate: '2026-05-01T00:00:00.000Z',
      interval: 12,
      active: true,
      vehicleId: 'v2',
    });
    await act(async () => {
      render(<RecurringFormPage />);
    });
    expect(screen.getByLabelText('vehicles.selectLabel')).toHaveValue('v2');
  });
});
