import { defineConfig } from 'vitest/config'

export const nodePackageConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts'] },
  },
})
