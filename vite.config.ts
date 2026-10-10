import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Firebase functions use Node's built-in test runner, not Vitest.
    // Only discover React/TypeScript tests in the frontend source tree.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
