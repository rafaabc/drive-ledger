import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

// PWAUpdater keeps a module-scope `refreshing` guard so it survives remounts
// in the real app — but that means it must be re-imported fresh in every
// test here, or one test's reload leaks into the next via the guard.
let PWAUpdater;

// Minimal fake ServiceWorkerRegistration/EventTarget the component talks to.
function makeFakeRegistration({ waiting = null } = {}) {
  const listeners = {};
  return {
    waiting,
    installing: null,
    update: vi.fn(),
    addEventListener: vi.fn((type, cb) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    }),
    _emit(type, event) {
      (listeners[type] || []).forEach((cb) => cb(event));
    },
  };
}

function makeFakeServiceWorkerContainer(reg) {
  const listeners = {};
  return {
    controller: {},
    ready: Promise.resolve(reg),
    addEventListener: vi.fn((type, cb) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    }),
    removeEventListener: vi.fn((type, cb) => {
      listeners[type] = (listeners[type] || []).filter((fn) => fn !== cb);
    }),
    _emit(type, event) {
      (listeners[type] || []).forEach((cb) => cb(event));
    },
  };
}

describe('PWAUpdater', () => {
  let reload;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ default: PWAUpdater } = await import('@/components/PWAUpdater'));
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the update toast when a worker is already waiting on mount', async () => {
    const waitingSW = { postMessage: vi.fn() };
    const reg = makeFakeRegistration({ waiting: waitingSW });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: makeFakeServiceWorkerContainer(reg),
    });

    render(<PWAUpdater />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('pwa.updateAvailable')).toBeInTheDocument();
  });

  it('does not reload synchronously on click — waits for controllerchange', async () => {
    const waitingSW = { postMessage: vi.fn() };
    const reg = makeFakeRegistration({ waiting: waitingSW });
    const sw = makeFakeServiceWorkerContainer(reg);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });

    render(<PWAUpdater />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('pwa.reload'));

    expect(waitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once controllerchange fires', async () => {
    const waitingSW = { postMessage: vi.fn() };
    const reg = makeFakeRegistration({ waiting: waitingSW });
    const sw = makeFakeServiceWorkerContainer(reg);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });

    render(<PWAUpdater />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('pwa.reload'));
    act(() => sw._emit('controllerchange'));
    act(() => sw._emit('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('falls back to reload if controllerchange never fires', async () => {
    const waitingSW = { postMessage: vi.fn() };
    const reg = makeFakeRegistration({ waiting: waitingSW });
    const sw = makeFakeServiceWorkerContainer(reg);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });

    render(<PWAUpdater />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('pwa.reload'));
    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checks for updates when the tab becomes visible again', async () => {
    const reg = makeFakeRegistration();
    const sw = makeFakeServiceWorkerContainer(reg);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });

    render(<PWAUpdater />);
    await act(async () => {
      await Promise.resolve();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(reg.update).toHaveBeenCalled();
  });
});
