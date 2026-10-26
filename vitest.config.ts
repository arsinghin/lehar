import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/core/**/*.test.ts',
            'src/lib/**/*.test.ts',
            'src/features/**/*.test.ts',
            'src/styles/**/*.test.ts',
            'server/**/*.test.ts',
            'api/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'src/state/**/*.test.ts'],
          setupFiles: ['./tests/setup-dom.ts'],
          // Full user journeys with axe checks and lazily loaded panels run several seconds on slower
          // laptops, especially under coverage. A generous ceiling keeps them deterministic there.
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts', 'src/core/types.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
        'src/core/**': { lines: 95, statements: 95, functions: 95, branches: 90 },
        'server/**': { lines: 95, statements: 95, functions: 95, branches: 88 },
      },
    },
  },
});
