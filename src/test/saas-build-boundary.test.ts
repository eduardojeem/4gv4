import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SaaS build boundary', () => {
  it('defers shared branding and child metadata queries until request time', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/saas/layout.tsx'), 'utf8')
    expect(layout).toContain("export const dynamic = 'force-dynamic'")
    expect(layout).toContain('getPlatformBranding()')
  })
})
