import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so tests load without the TanStack Start plugin.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['src/**/*.test.ts'] },
})
