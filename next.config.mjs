import withSerwistInit from '@serwist/next';
import { withSentryConfig } from '@sentry/nextjs';
import { withBotId } from 'botid/next/config';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

// Content-Security-Policy moved to proxy.mjs — it needs a fresh nonce per request
// (see F-08 fix), which a static headers() entry here can't provide.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
];

const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@sentry/nextjs', 'require-in-the-middle', 'pdfkit'],
  // 'mjs' lets Next discover proxy.mjs (its filename convention otherwise only
  // looks for proxy.{tsx,ts,jsx,js}) — .mjs parses as ESM under every bundler
  // regardless of package.json's "type": "commonjs", so no bundler-specific
  // rule is needed to force it, unlike the plain .js this file used to be.
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mjs'],
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

export default withSentryConfig(withSerwist(withBotId(nextConfig)), {
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
