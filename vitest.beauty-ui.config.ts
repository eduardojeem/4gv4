import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()], resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', globals: true, pool: 'threads', maxWorkers: 1, reporters: ['dot'],
    setupFiles: ['@testing-library/jest-dom/vitest'],
    include: ['src/components/admin/website/ServiceWebsitePreparationDialog.test.tsx', 'src/test/service-website-variants.test.tsx', 'src/components/dashboard/agenda/service-entry.test.tsx', 'src/components/dashboard/agenda/service-creation-ui.test.tsx'] },
})
