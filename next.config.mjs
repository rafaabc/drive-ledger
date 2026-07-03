import withSerwistInit from '@serwist/next';
import { withSentryConfig } from '@sentry/nextjs';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const isDev = process.env.NODE_ENV === 'development';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ''}accounts.google.com eu-assets.i.posthog.com`,
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com accounts.google.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "connect-src 'self' accounts.google.com *.sentry.io eu.i.posthog.com eu-assets.i.posthog.com",
      'frame-src accounts.google.com',
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@sentry/nextjs', 'require-in-the-middle', 'pdfkit'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  webpack(config) {
    config.module.rules.unshift({
      test: /[\\/](instrumentation(-client)?|sentry\.(client|server|edge)\.config)\.mjs$/,
      type: 'javascript/esm',
    });
    return config;
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'norevify',

  project: 'norevify',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
