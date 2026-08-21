import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    projects: ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
  },
});
