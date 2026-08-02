import { describe, expect, it } from 'vitest'

import { getHydrationSafeWebsiteSettingsState } from './hydration-state'

describe('getHydrationSafeWebsiteSettingsState', () => {
  const cachedSettings = { checkout: { commerceMode: 'cart' } }

  it('hides browser cache data until hydration completes', () => {
    expect(getHydrationSafeWebsiteSettingsState(false, cachedSettings, false)).toEqual({
      settings: null,
      isLoading: true,
    })
  })

  it('exposes SWR data after hydration', () => {
    expect(getHydrationSafeWebsiteSettingsState(true, cachedSettings, false)).toEqual({
      settings: cachedSettings,
      isLoading: false,
    })
  })
})
