import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-multiplayer',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4184' },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --workspace @whistzilla/multiplayer-api',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'npm run --workspace @whistzilla/web dev -- --host 127.0.0.1 --port 4184',
      url: 'http://127.0.0.1:4184/multiplayer',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
