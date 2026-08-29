import { describe, it, expect } from 'vitest';
import { redactSensitiveParams, redactEventProperties } from '@/components/PostHogProvider.jsx';

describe('redactSensitiveParams', () => {
  it('redacts the token query param from an absolute URL', () => {
    const url = 'https://app.norevify.com/reset-password?token=abc.def.ghi';
    expect(redactSensitiveParams(url)).toBe(
      'https://app.norevify.com/reset-password?token=%5Bredacted%5D',
    );
  });

  it('leaves URLs without a token param untouched', () => {
    const url = 'https://app.norevify.com/dashboard?year=2026';
    expect(redactSensitiveParams(url)).toBe(url);
  });

  it('preserves other query params alongside the redacted token', () => {
    const url = 'https://app.norevify.com/verify-email?ref=email&token=secret123';
    const result = redactSensitiveParams(url);
    expect(result).toContain('ref=email');
    expect(result).not.toContain('secret123');
  });

  it('returns non-string/empty input unchanged', () => {
    expect(redactSensitiveParams(undefined)).toBeUndefined();
    expect(redactSensitiveParams('')).toBe('');
  });

  it('returns unparseable strings unchanged instead of throwing', () => {
    expect(redactSensitiveParams('not a url')).toBe('not a url');
  });
});

describe('redactEventProperties', () => {
  it('redacts token from $current_url and $referrer', () => {
    const event = {
      event: '$pageview',
      properties: {
        $current_url: 'https://app.norevify.com/reset-password?token=leak-me',
        $referrer: 'https://app.norevify.com/reset-password?token=leak-me',
      },
    };
    const result = redactEventProperties(event);
    expect(result.properties.$current_url).not.toContain('leak-me');
    expect(result.properties.$referrer).not.toContain('leak-me');
  });

  it('is a no-op for events without properties', () => {
    expect(redactEventProperties({ event: '$pageview' })).toEqual({ event: '$pageview' });
  });

  it('passes through events with no sensitive params', () => {
    const event = { event: '$pageview', properties: { $current_url: 'https://x.com/dashboard' } };
    expect(redactEventProperties(event).properties.$current_url).toBe('https://x.com/dashboard');
  });
});
