'use client';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

// Query-string keys that carry one-time secrets (password-reset and
// email-verification JWTs). PostHog's autocaptured $current_url/$referrer
// otherwise ship the full URL, including these tokens, to a third party.
const SENSITIVE_QUERY_PARAMS = ['token'];

export function redactSensitiveParams(url) {
  if (typeof url !== 'string' || !url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  let changed = false;
  for (const key of SENSITIVE_QUERY_PARAMS) {
    if (parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, '[redacted]');
      changed = true;
    }
  }
  return changed ? parsed.toString() : url;
}

export function redactEventProperties(event) {
  if (!event?.properties) return event;
  if (event.properties.$current_url) {
    event.properties.$current_url = redactSensitiveParams(event.properties.$current_url);
  }
  if (event.properties.$referrer) {
    event.properties.$referrer = redactSensitiveParams(event.properties.$referrer);
  }
  return event;
}

export default function PostHogProvider({ children }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: true },
      before_send: redactEventProperties,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
