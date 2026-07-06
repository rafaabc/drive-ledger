import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminLayout from '@/app/(admin)/layout.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/users',
}));

let mockIsAuthed = false;
let mockAuthLoading = false;
let mockRole = 'user';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    isAuthed: mockIsAuthed,
    authLoading: mockAuthLoading,
    role: mockRole,
  }),
}));

vi.mock('@/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthed = false;
    mockAuthLoading = false;
    mockRole = 'user';
  });

  it('should render nothing while auth is loading', () => {
    mockAuthLoading = true;
    const { container } = render(
      <AdminLayout>
        <div>child</div>
      </AdminLayout>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should redirect to /login when not authed', async () => {
    mockIsAuthed = false;
    mockAuthLoading = false;
    render(
      <AdminLayout>
        <div>child</div>
      </AdminLayout>,
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('should redirect to /dashboard when authed but not admin', async () => {
    mockIsAuthed = true;
    mockAuthLoading = false;
    mockRole = 'user';
    render(
      <AdminLayout>
        <div>child</div>
      </AdminLayout>,
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should render children inside AppShell when authed and admin', () => {
    mockIsAuthed = true;
    mockAuthLoading = false;
    mockRole = 'admin';
    render(
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>,
    );
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('admin content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
