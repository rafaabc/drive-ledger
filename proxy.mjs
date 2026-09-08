// .mjs (not .js) so this parses as ESM unambiguously under both webpack and
// Turbopack, regardless of package.json's "type": "commonjs" — Next's proxy
// file-export detection statically requires `export`/`export default`
// syntax. Discovering a proxy.mjs file requires 'mjs' in pageExtensions
// (see next.config.mjs); a plain proxy.js previously needed a bundler-
// specific rule forcing ESM parsing, which webpack honored but Turbopack
// (`next dev --turbo`) didn't, so `npm run dev` 500'd on every route.
import { NextResponse } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

// The other security headers (HSTS, X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, Permissions-Policy) stay static in next.config.mjs's headers() —
// only the CSP needs a fresh per-request nonce, so only it lives here.
function buildCspHeader(nonce) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets scripts the nonce'd bundle itself creates (e.g.
    // GoogleSignInButton's document.createElement('script')) load without being
    // individually nonce'd — the host allowlist stays as a fallback for browsers
    // that don't support strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval' " : ''}accounts.google.com`,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com accounts.google.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "connect-src 'self' accounts.google.com *.sentry.io",
    'frame-src accounts.google.com',
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce);

  // x-nonce lets app/layout.jsx read the same nonce back via next/headers, forcing
  // this route into dynamic rendering — required for Next to attach the nonce it
  // parses from the response's CSP header to its own framework/page scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    {
      // /monitoring is the Sentry tunnelRoute (see next.config.mjs) — excluded so this
      // proxy never touches that beacon passthrough, per the warning already noted
      // there about middleware/proxy interfering with it.
      source: '/((?!api|monitoring|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
