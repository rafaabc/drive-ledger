'use client';
import { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/navigation';
import { authApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

let scriptInjected = false;

function injectGisScript() {
  if (scriptInjected || document.getElementById('gis-script')) return;
  scriptInjected = true;
  const s = document.createElement('script');
  s.id = 'gis-script';
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

export default function GoogleSignInButton({ mode = 'login', onSuccess, onError, inviteCode }) {
  const { login } = useAuth() || {};
  const router = useRouter();
  const containerRef = useRef(null);

  const handleCredential = useCallback(
    async ({ credential }) => {
      try {
        if (mode === 'link') {
          await authApi.linkGoogle({ idToken: credential });
          onSuccess?.();
        } else {
          const { token } = await authApi.googleLogin({ idToken: credential, inviteCode });
          login(token);
          router.push('/');
        }
      } catch (err) {
        onError?.(err.message);
      }
    },
    [mode, login, router, onSuccess, onError, inviteCode],
  );

  useEffect(() => {
    if (!CLIENT_ID) return;
    injectGisScript();

    let interval;

    function init() {
      if (!globalThis.google?.accounts?.id || !containerRef.current) return;

      globalThis.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });

      globalThis.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: containerRef.current.offsetWidth || 360,
        text: mode === 'register' ? 'signup_with' : 'signin_with',
      });

      if ((mode === 'login' || mode === 'register') && process.env.NODE_ENV !== 'development') {
        globalThis.google.accounts.id.prompt();
      }
    }

    if (globalThis.google?.accounts?.id) {
      init();
    } else {
      interval = setInterval(() => {
        if (globalThis.google?.accounts?.id) {
          clearInterval(interval);
          init();
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [mode, handleCredential]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} style={{ width: '100%' }} />;
}

GoogleSignInButton.propTypes = {
  inviteCode: PropTypes.string,
};
