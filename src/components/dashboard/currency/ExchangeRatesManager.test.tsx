import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExchangeRates } from './ExchangeRatesManager'

describe('useExchangeRates', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('expone un error recuperable cuando falla la red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))

    const { result } = renderHook(() => useExchangeRates())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state).toBeNull()
    expect(result.current.error).toBe('No se pudieron cargar los tipos de cambio')
  })
})
