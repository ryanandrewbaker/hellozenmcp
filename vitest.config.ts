import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Do not load the deployment .env during tests.
  envDir: 'tests',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
