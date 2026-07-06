import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import AdminUsersPage from '@/views/AdminUsersPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/components/Loading.jsx', () => ({ default: () => <div data-testid="loading" /> }));
vi.mock('@/utils/formatDate.js', () => ({ formatDate: (d) => `formatted:${d}` }));

const mockListUsers = vi.fn();
const mockSetUserPlan = vi.fn();
vi.mock('@/services/apiService.js', () => ({
  adminApi: {
    listUsers: (...args) => mockListUsers(...args),
    setUserPlan: (...args) => mockSetUserPlan(...args),
  },
}));

const users = [
  {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    plan: 'free',
    planSource: 'stripe',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    username: 'bob',
    email: 'bob@example.com',
    plan: 'pro',
    planSource: 'manual',
    role: 'admin',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue(users);
    mockSetUserPlan.mockResolvedValue({ ...users[0], plan: 'pro' });
  });

  it('should show loading state while fetching', async () => {
    let resolveList;
    mockListUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    render(<AdminUsersPage />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await act(async () => {
      resolveList(users);
    });
  });

  it('should render a table row per user with the expected columns', async () => {
    await act(async () => {
      render(<AdminUsersPage />);
    });
    const aliceRow = screen.getByText('alice').closest('tr');
    expect(aliceRow).not.toBeNull();
    expect(within(aliceRow).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(aliceRow).getByText('free')).toBeInTheDocument();
    expect(within(aliceRow).getByText('stripe')).toBeInTheDocument();
    expect(within(aliceRow).getByText('user')).toBeInTheDocument();
    expect(within(aliceRow).getByText(/formatted:/)).toBeInTheDocument();

    const bobRow = screen.getByText('bob').closest('tr');
    expect(within(bobRow).getByText('pro')).toBeInTheDocument();
    expect(within(bobRow).getByText('manual')).toBeInTheDocument();
    expect(within(bobRow).getByText('admin')).toBeInTheDocument();
  });

  it('should show error banner when fetch fails', async () => {
    mockListUsers.mockRejectedValue(new Error('boom'));
    await act(async () => {
      render(<AdminUsersPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('should call adminApi.setUserPlan with the toggled plan when the toggle button is clicked', async () => {
    await act(async () => {
      render(<AdminUsersPage />);
    });
    const aliceRow = screen.getByText('alice').closest('tr');
    const toggleBtn = within(aliceRow).getByRole('button');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(mockSetUserPlan).toHaveBeenCalledWith('u1', 'pro');
  });

  it('should reload the list after a successful plan toggle', async () => {
    await act(async () => {
      render(<AdminUsersPage />);
    });
    expect(mockListUsers).toHaveBeenCalledTimes(1);
    const aliceRow = screen.getByText('alice').closest('tr');
    const toggleBtn = within(aliceRow).getByRole('button');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(mockListUsers).toHaveBeenCalledTimes(2);
  });

  it('should show an error banner when the plan toggle fails', async () => {
    mockSetUserPlan.mockRejectedValue(new Error('plan update failed'));
    await act(async () => {
      render(<AdminUsersPage />);
    });
    const aliceRow = screen.getByText('alice').closest('tr');
    const toggleBtn = within(aliceRow).getByRole('button');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('plan update failed');
  });
});
