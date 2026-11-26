import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ['tests/api.test.js','tests/core.test.js','tests/payroll-api.test.js','tests/erp-api.test.js']
  }
});