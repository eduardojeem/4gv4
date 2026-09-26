import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCustomerDuplicates } from '@/hooks/use-customer-duplicates'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('avisos de clientes duplicados', () => {
  it('oculta el aviso anterior mientras comprueba otro teléfono', async () => {
    vi.useFakeTimers()
    const duplicate = { id: 'c1', name: 'Ana', matches: ['phone'] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ duplicates: [duplicate] }) }))
    const { result, rerender } = renderHook(({ phone }) => useCustomerDuplicates({ phone }), { initialProps: { phone: '0981123456' } })
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(result.current).toEqual([duplicate])

    rerender({ phone: '0981654321' })
    expect(result.current).toEqual([])
  })

  it('no vuelve a mostrar una respuesta tardía después de vaciar el campo', async () => {
    vi.useFakeTimers()
    let finish!: (value: { json: () => Promise<unknown> }) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
    const { result, rerender } = renderHook(({ phone }) => useCustomerDuplicates({ phone }), { initialProps: { phone: '0981123456' } })
    await act(() => vi.advanceTimersByTimeAsync(350))
    rerender({ phone: '' })
    await act(async () => finish({ json: async () => ({ duplicates: [{ id: 'c1' }] }) }))
    expect(result.current).toEqual([])
  })
})
