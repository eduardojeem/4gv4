import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useMultipleIntervals } from '@/hooks/use-interval-manager'

describe('useMultipleIntervals', () => {
  it('actualiza el contador al agregar y quitar un intervalo', () => {
    const { result, unmount } = renderHook(() => useMultipleIntervals())

    act(() => {
      result.current.addInterval('inventario', () => {}, 60_000)
    })
    expect(result.current.activeCount).toBe(1)

    act(() => {
      result.current.removeInterval('inventario')
    })
    expect(result.current.activeCount).toBe(0)
    unmount()
  })
})
