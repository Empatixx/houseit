import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export const reactPackageConfig = defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
