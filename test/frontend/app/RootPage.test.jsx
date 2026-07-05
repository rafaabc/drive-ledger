import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RootPage from '@/app/page.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

let mockIsAuthed = false;
let mockAuthLoading = false;

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    isAuthed: mockIsAuthed,
    authLoading: mockAuthLoading,
  }),
}));

vi.mock('@/views/LandingPage.jsx', () => ({
  default: () => <div data-testid="landing-page">landing</div>,
}));

vi.mock('@/components/Loading.jsx', () => ({
  default: () => <div aria-label="common.loading" data-testid="loading" />,
}));

describe('RootPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthed = false;
    mockAuthLoading = false;
    mockReplace.mockClear();
  });

  it('should render Loading when authLoading is true', () => {
    mockAuthLoading = true;
    render(<RootPage />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should call router.replace with /dashboard when authed', async () => {
    mockIsAuthed = true;
    mockAuthLoading = false;
    render(<RootPage />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should render LandingPage when not authed and authLoading is false', () => {
    mockIsAuthed = false;
    mockAuthLoading = false;
    render(<RootPage />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
