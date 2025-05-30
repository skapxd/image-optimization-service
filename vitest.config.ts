import 'dotenv/config';

import { resolve } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const testResultDir = resolve(__dirname, 'test-reporter');

export default defineConfig({
  test: {
    hookTimeout: 1_000_000,
    testTimeout: 1_000_000,
    coverage: {
      enabled: true,
      // provider: 'istanbul',
      provider: 'v8',
      reporter: ['html'],
      reportsDirectory: resolve(testResultDir, 'coverage'),
      include: ['src/**/*.ts'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    outputFile: resolve(testResultDir, 'index.html'),
    reporters: ['default', 'html'],
    globals: true,
    root: './',
    alias: {
      '#': resolve(__dirname),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
