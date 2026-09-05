'use client';
import { useEffect, useRef, useState } from 'react';
import UpdatePrompt from './UpdatePrompt';

// Guards against the reload firing twice (once from 'controllerchange', once
// from the fallback timeout) — module scope so it survives remounts too.
let refreshing = false;

const UPDATE_CHECK_THROTTLE_MS = 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const SKIP_WAITING_FALLBACK_MS = 3000;

export default function PWAUpdater() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [waitingSW, setWaitingSW] = useState(null);
  const fallbackTimeoutRef = useRef(null);
  const reloadRef = useRef(() => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let lastUpdateCheck = 0;
    let regRef = null;
    const reload = () => reloadRef.current();

    // Fires once the new worker actually takes control of this page — the
    // only reliable signal that the reload will serve the new build.
    navigator.serviceWorker.addEventListener('controllerchange', reload);

    navigator.serviceWorker.ready.then((reg) => {
      regRef = reg;
      if (reg.waiting) {
        setWaitingSW(reg.waiting);
        setShowPrompt(true);
      }
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(newSW);
            setShowPrompt(true);
          }
        });
      });
    });

    // A resumed standalone PWA can sit idle for a long time without a cold
    // launch, so poll for updates instead of only checking on install.
    const checkForUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateCheck < UPDATE_CHECK_THROTTLE_MS) return;
      lastUpdateCheck = now;
      regRef?.update();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(intervalId);
      clearTimeout(fallbackTimeoutRef.current);
    };
  }, []);

  const handleUpdate = () => {
    setShowPrompt(false);
    if (waitingSW) {
      waitingSW.postMessage({ type: 'SKIP_WAITING' });
    }
    // postMessage is async and 'controllerchange' should follow shortly; if
    // it's dropped (or waitingSW never showed up) reload anyway so the user
    // isn't stuck — the 'refreshing' guard inside reloadRef still stops a
    // double-reload if controllerchange fires around the same time.
    fallbackTimeoutRef.current = setTimeout(() => reloadRef.current(), SKIP_WAITING_FALLBACK_MS);
  };

  if (!showPrompt) return null;
  return <UpdatePrompt onUpdate={handleUpdate} />;
}
