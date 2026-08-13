import { describe, expect, it } from 'vitest'

import { adminFinanceSummarySWRConfig } from './use-admin-finances'

describe('admin finance summary refresh policy', () => {
  it('avoids automatic revalidations while an administrator is working', () => {
    expect(adminFinanceSummarySWRConfig).toMatchObject({
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshInterval: 0,
      dedupingInterval: 60_000,
    })
  })
})
