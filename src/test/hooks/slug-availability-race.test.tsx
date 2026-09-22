import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSlugAvailability } from '@/hooks/use-slug-availability'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('disponibilidad de direcciones', () => {
  it('ignora una respuesta tardía después de borrar la dirección', async () => {
    vi.useFakeTimers()
    let resolve!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
    const { result, rerender } = renderHook(({ value }) => useSlugAvailability(value), { initialProps: { value: 'mi-tienda' } })
    await act(() => vi.advanceTimersByTimeAsync(450))
    rerender({ value: '' })
    await act(async () => resolve({ ok: true, json: async () => ({ available: true }) } as Response))
    expect(result.current.estado).toBe('vacio')
  })

  it('no muestra la disponibilidad de otra dirección mientras consulta', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) }))
    const { result, rerender } = renderHook(({ value }) => useSlugAvailability(value), { initialProps: { value: 'mi-tienda' } })
    await act(() => vi.advanceTimersByTimeAsync(450))
    expect(result.current.estado).toBe('libre')
    rerender({ value: 'otra-tienda' })
    expect(result.current).toEqual({ estado: 'consultando', slug: 'otra-tienda' })
  })
})
