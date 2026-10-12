import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
// Focused real DOM tests without the unrelated global auth/network mocks.
export default defineConfig({
  plugins: [react()], resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', globals: true, pool: 'threads', maxWorkers: 1,
    setupFiles: ['@testing-library/jest-dom/vitest'],
    include: ['src/test/customer-credit-file-ui.test.tsx', 'src/test/customer-credit-file-pos.test.tsx'] },
})
