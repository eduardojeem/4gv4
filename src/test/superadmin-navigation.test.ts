import { describe, expect, it } from 'vitest'
import { uniqueNavigationItems } from '@/lib/superadmin/navigation'

describe('uniqueNavigationItems', () => {
  it('keeps the first item for each route', () => {
    expect(uniqueNavigationItems([
      { href: '/superadmin', title: 'Resumen' },
      { href: '/superadmin', title: 'Panel general' },
      { href: '/superadmin/analytics', title: 'Analiticas' },
    ])).toEqual([
      { href: '/superadmin', title: 'Resumen' },
      { href: '/superadmin/analytics', title: 'Analiticas' },
    ])
  })
})
