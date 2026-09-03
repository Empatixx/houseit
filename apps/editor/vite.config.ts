import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // Where the system hands out no file events — an agent's shell, some
    // containers — HOUSEIT_POLL=1 has the dev server look for changes itself.
    watch: process.env.HOUSEIT_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
})
