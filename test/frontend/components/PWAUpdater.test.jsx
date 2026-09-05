import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

// PWAUpdater keeps a module-scope `refreshing` guard so it survives remounts
// in the real app — but that means it must be re-imported fresh in every
// test here, or one test's reload leaks into the next via the guard.
let PWAUpdater;

// Minimal fake ServiceWorkerRegistration/EventTarget the component talks to.
function makeEventTarget(extra = {}) {
  const listeners = {};
  return {
    ...extra,
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

// Renders PWAUpdater with a fake navigator.serviceWorker wired up, and waits
// for the ready-promise microtask so the component's effect has settled.
async function renderWithServiceWorker({ waiting = null } = {}) {
  const reg = makeEventTarget({ waiting, installing: null, update: vi.fn() });
  const sw = makeEventTarget({ controller: {}, ready: Promise.resolve(reg) });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });

  render(<PWAUpdater />);
  await act(async () => {
    await Promise.resolve();
  });

  return { reg, sw };
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
    await renderWithServiceWorker({ waiting: waitingSW });

    expect(screen.getByText('pwa.updateAvailable')).toBeInTheDocument();
  });

  it('does not reload synchronously on click — waits for controllerchange', async () => {
    const waitingSW = { postMessage: vi.fn() };
    await renderWithServiceWorker({ waiting: waitingSW });

    fireEvent.click(screen.getByText('pwa.reload'));

    expect(waitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once controllerchange fires', async () => {
    const waitingSW = { postMessage: vi.fn() };
    const { sw } = await renderWithServiceWorker({ waiting: waitingSW });

    fireEvent.click(screen.getByText('pwa.reload'));
    act(() => sw._emit('controllerchange'));
    act(() => sw._emit('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('falls back to reload if controllerchange never fires', async () => {
    const waitingSW = { postMessage: vi.fn() };
    await renderWithServiceWorker({ waiting: waitingSW });

    fireEvent.click(screen.getByText('pwa.reload'));
    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checks for updates when the tab becomes visible again', async () => {
    const { reg } = await renderWithServiceWorker();

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
