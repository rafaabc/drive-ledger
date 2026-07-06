import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '@/components/Sidebar';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/components/Sidebar.module.css', () => ({ default: {} }));

const mockLogout = vi.fn();
let mockRole = 'user';
vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({ username: 'testuser', logout: mockLogout, role: mockRole }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'user';
  });

  it('should render brand name', () => {
    render(<Sidebar />);
    expect(screen.getByText('NORE')).toBeInTheDocument();
  });

  it('should render username', () => {
    render(<Sidebar />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('should render all nav links', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /nav.dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.reminders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nav.summary/i })).toBeInTheDocument();
  });

  it('should render badge when badgeCount > 0', () => {
    render(<Sidebar badgeCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should not render badge when badgeCount is 0', () => {
    render(<Sidebar badgeCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('should call logout when logout button clicked', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'nav.logout' }));
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('should not render the admin nav link for a non-admin role', () => {
    mockRole = 'user';
    render(<Sidebar />);
    expect(screen.queryByRole('link', { name: /nav.admin/i })).toBeNull();
  });

  it('should render the admin nav link for the admin role', () => {
    mockRole = 'admin';
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /nav.admin/i })).toBeInTheDocument();
  });
});
