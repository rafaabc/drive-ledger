import { headers } from 'next/headers';
import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext.jsx';
import I18nProvider from '@/components/I18nProvider.jsx';
import PWAUpdater from '@/components/PWAUpdater.jsx';
import PostHogProvider from '@/components/PostHogProvider.jsx';

export const metadata = {
  title: 'Norevify',
  description: 'Track every kilometer.',
};

export default async function RootLayout({ children }) {
  // Reading headers() opts every route into dynamic rendering — required so Next
  // attaches the per-request nonce (set by proxy.js) to its own framework/page
  // scripts, which is what lets script-src drop 'unsafe-inline' (see F-08 fix).
  await headers();

  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
        <meta name="theme-color" content="#0c0d0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Norevify" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <PostHogProvider>
          <I18nProvider>
            <AuthProvider>
              <PWAUpdater />
              {children}
            </AuthProvider>
          </I18nProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
