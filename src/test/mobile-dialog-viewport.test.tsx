import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMobileDialogViewport } from '@/hooks/use-mobile-dialog-viewport'
afterEach(() => vi.unstubAllGlobals())
describe('modal con teclado móvil', () => {
  it('se adapta al teclado y no fuerza el zoom manual', () => {
    const viewport = Object.assign(new EventTarget(), { height: 780, offsetTop: 0, scale: 1 })
    vi.stubGlobal('innerWidth', 390)
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useMobileDialogViewport(true))
    expect(result.current).toEqual({ height: 780, top: 0 })
    act(() => { viewport.height = 380; viewport.offsetTop = 25; viewport.dispatchEvent(new Event('resize')) })
    expect(result.current).toEqual({ height: 380, top: 25 })
    act(() => { viewport.scale = 2; viewport.height = 190; viewport.dispatchEvent(new Event('resize')) })
    expect(result.current).toEqual({})
  })
  it('no altera el diálogo de escritorio', () => {
    vi.stubGlobal('innerWidth', 1024)
    const { result } = renderHook(() => useMobileDialogViewport(true))
    expect(result.current).toEqual({})
  })
})
