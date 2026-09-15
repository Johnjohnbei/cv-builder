import { defineConfig, devices } from '@playwright/test';

/**
 * The suite starts its own server on a dedicated port, never a developer's dev
 * server: that one reads .env.local, whose VITE_PORTFOLIO_VARIANTS holds real
 * portfolio links. Vite lets a variable already set in the process win over
 * .env files, so the variants below are the only ones the tests ever see.
 */
const E2E_PORT = 3100;
const E2E_PORTFOLIO_VARIANTS = JSON.stringify([
  {
    id: 'design-system',
    label: 'Portfolio Design System',
    url: 'https://example.com/portfolio/design-system',
    anonUrl: 'https://example.com/cv/ab12',
    keywords: ['systeme de design', 'design system', 'accessibilite', 'tokens'],
  },
  {
    id: 'ia',
    label: 'Portfolio IA',
    url: 'https://example.com/portfolio/ia',
    keywords: ['intelligence artificielle', 'IA', 'LLM'],
  },
]);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx vite --port=${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_PORTFOLIO_VARIANTS: E2E_PORTFOLIO_VARIANTS },
  },
});
