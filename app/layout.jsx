import { headers, cookies } from 'next/headers';
import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext.jsx';
import I18nProvider from '@/components/I18nProvider.jsx';
import PWAUpdater from '@/components/PWAUpdater.jsx';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LANG_COOKIE } from '@/utils/languageCookie.js';

const SUPPORTED_LANGUAGES = ['pt-BR', 'en'];

export const metadata = {
  title: 'Norevify',
  description: 'Track every kilometer.',
};

export default async function RootLayout({ children }) {
  // Reading headers() opts every route into dynamic rendering — required so Next
  // attaches the per-request nonce (set by proxy.mjs) to its own framework/page
  // scripts, which is what lets script-src drop 'unsafe-inline' (see F-08 fix).
  await headers();

  // 'lang' cookie (see utils/languageCookie.js) mirrors localStorage['i18nextLng'] so SSR
  // renders in the visitor's actual language — otherwise the server always rendered
  // pt-BR while an 'en' client hydrated in English, a mismatch on every page.
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = SUPPORTED_LANGUAGES.includes(cookieLang) ? cookieLang : 'pt-BR';

  return (
    <html lang={lang}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
        <meta name="theme-color" content="#0c0d0f" />
        <meta name="mobile-web-app-capable" content="yes" />
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
        <I18nProvider initialLanguage={lang}>
          <AuthProvider>
            <PWAUpdater />
            {children}
          </AuthProvider>
        </I18nProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
