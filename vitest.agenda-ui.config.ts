import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
export default defineConfig({ plugins: [react()], resolve: { alias: { '@': resolve(__dirname,'src') } },
  test: { globals: true, environment:'jsdom', reporters:['dot'], maxWorkers:1,
    setupFiles: ['@testing-library/jest-dom/vitest'], include:['src/test/*booking-professionals.test.tsx','src/test/agenda-professional-settings.test.tsx','src/test/agenda-appointments.test.ts'] },
})
