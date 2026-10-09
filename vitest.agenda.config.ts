import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Server/pure booking tests need neither the DOM nor shared HTML report files.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', globals: true, reporters: ['dot'], maxWorkers: 1,
    include: ['src/test/agenda-*.test.ts', 'src/test/public-agenda-*.test.ts'],
    exclude: ['src/test/agenda-appointments.test.ts'] },
})
