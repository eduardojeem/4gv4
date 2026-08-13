import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin finance home entry', () => {
  it('offers Finanzas as a direct administration dashboard entry', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')

    expect(source).toContain("title: 'Finanzas'")
    expect(source).toContain("href: '/admin/finances'")
    expect(source).toContain('WalletCards')
  })
})
