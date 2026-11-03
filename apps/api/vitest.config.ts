import { defineConfig } from 'vitest/config';

// Integration suites share the isolated test DB (settings, migrations, locks).
// Keep files sequential so one fixture cannot change another suite's policy.
export default defineConfig({
  test: { fileParallelism: false, hookTimeout: 120000, testTimeout: 60000 },
});
