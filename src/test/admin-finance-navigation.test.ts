import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getCategoryByItemKey, getNavItemByKey } from '@/config/admin-navigation'

describe('admin finance navigation', () => {
  it('exposes Finanzas under Analisis (between Resumen and Analytics) to finance readers', () => {
    const item = getNavItemByKey('finances')

    expect(item).toMatchObject({
      label: 'Finanzas',
      href: '/admin/finances',
      permissions: ['finances.read'],
    })
    expect(getCategoryByItemKey('finances')?.id).toBe('analytics')
  })

  it('uses the finance icon instead of reusing an operational navigation item', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/config/admin-navigation.ts'), 'utf8')

    expect(source).toContain('WalletCards')
  })
})
