import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReminderFormPage from '@/views/ReminderFormPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/components/ReminderTypeSelect.jsx', () => ({
  default: ({ value, onChange }) => (
    <select name="type" value={value} onChange={onChange} data-testid="type-select">
      <option value="Maintenance">Maintenance</option>
      <option value="Fuel">Fuel</option>
    </select>
  ),
}));
vi.mock('@/utils/formatDate.js', () => ({ todayISO: () => '2026-05-20' }));

const mockPush = vi.fn();
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
  remindersApi: {
    create: () => mockCreate(),
    update: (...a) => mockUpdate(...a),
    get: (id) => mockGet(id),
  },
  vehiclesApi: {
    list: () => mockVehiclesList(),
  },
}));

describe('ReminderFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUseParams.mockReturnValue({});
    mockVehiclesList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it('should render create heading when no id', () => {
    render(<ReminderFormPage />);
    expect(screen.getByText('reminders.newReminder')).toBeInTheDocument();
  });

  it('should show validation error when no dueDate or dueKm', async () => {
    render(<ReminderFormPage />);
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'common.save' }).closest('form'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('errors.reminderMissingDue');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call create and navigate to /reminders on valid submit', async () => {
    render(<ReminderFormPage />);
    fireEvent.change(screen.getByLabelText('reminders.fields.dueDate'), {
      target: { value: '2026-06-01', name: 'dueDate' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'common.save' }).closest('form'));
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/reminders');
  });

  it('should call create with dueKm when dueDate is empty', async () => {
    render(<ReminderFormPage />);
    fireEvent.change(screen.getByLabelText('reminders.fields.dueKm'), {
      target: { value: '15000', name: 'dueKm' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'common.save' }).closest('form'));
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('should show error banner when create fails', async () => {
    mockCreate.mockRejectedValue(new Error('server error'));
    render(<ReminderFormPage />);
    fireEvent.change(screen.getByLabelText('reminders.fields.dueDate'), {
      target: { value: '2026-06-01', name: 'dueDate' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'common.save' }).closest('form'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('server error');
  });

  it('should navigate to /reminders when cancel clicked', () => {
    render(<ReminderFormPage />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(mockPush).toHaveBeenCalledWith('/reminders');
  });

  it('should load existing reminder data in edit mode', async () => {
    mockUseParams.mockReturnValue({ id: 'r1' });
    mockGet.mockResolvedValue({
      type: 'Fuel',
      title: 'Oil check',
      dueDate: '2026-07-01T00:00:00.000Z',
      dueKm: null,
      intervalMonths: null,
      intervalKm: null,
    });
    await act(async () => {
      render(<ReminderFormPage />);
    });
    expect(screen.getByText('reminders.editReminder')).toBeInTheDocument();
    expect(screen.getByLabelText('reminders.fields.title')).toHaveValue('Oil check');
  });

  it('should show load error when get fails in edit mode', async () => {
    mockUseParams.mockReturnValue({ id: 'r1' });
    mockGet.mockRejectedValue(new Error('not found'));
    await act(async () => {
      render(<ReminderFormPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('not found');
  });
});
