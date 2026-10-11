import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Pure/SQL tests do not need the shared browser mocks or HTML reports.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', globals: true, reporters: ['dot'], pool: 'threads', maxWorkers: 1,
    include: ['src/test/beauty-*.test.ts', 'src/test/agenda-service-creation-*.test.ts', 'src/lib/organization/service-*.test.ts', 'src/lib/website/service-*.test.ts'] },
})
