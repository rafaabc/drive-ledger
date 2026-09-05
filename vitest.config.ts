import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/frontend/setup.tsx'],
    include: ['test/frontend/**/*.test.{js,jsx,ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'components/**/*.{js,jsx}',
        'views/**/*.{js,jsx}',
        'hooks/**/*.{js,jsx}',
        'context/**/*.{js,jsx}',
        'services/**/*.{js,jsx}',
        'utils/**/*.{js,jsx}',
        'i18n/index.js',
        'i18n/apiErrors.js',
        'lib/constants/**/*.{js,jsx}',
      ],
      exclude: [
        'components/charts/**',
        'components/UpdatePrompt.jsx',
        'components/GoogleSignInButton.jsx',
        'components/PostHogProvider.jsx',
        '**/*.module.css',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
