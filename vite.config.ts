import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  ...(mode === 'test'
    ? {
        define: {
          'import.meta.env.VITE_API_URL': JSON.stringify(
            'http://localhost:3000/api',
          ),
        },
      }
    : {}),
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}))
