import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { DEFAULT_PLATFORM_BRANDING } from '@/lib/platform/branding'
describe('identidad durante la carga', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('no muestra una marca antigua mientras espera la red', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(() => usePlatformBranding())
    expect(result.current.branding.platformName).not.toMatch(/servix/i)
    expect(result.current.branding.logoUrl).toBe('')
  })
  it('conserva la identidad recibida del servidor ante errores', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    const initial = { ...DEFAULT_PLATFORM_BRANDING, platformName: 'Mi marca', logoUrl: '/mi-logo.png' }
    const { result } = renderHook(() => usePlatformBranding(initial))
    expect(result.current.branding.platformName).toBe('Mi marca')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current.branding.logoUrl).toBe('/mi-logo.png')
  })
})
