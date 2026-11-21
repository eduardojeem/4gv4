import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDigitShortcutGuard } from '../digit-shortcut-guard'

describe('atajo 1-9 del POS frente al lector de códigos', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const press = (guard: ReturnType<typeof createDigitShortcutGuard>, keys: string, gapMs: number) => {
    for (const key of keys) {
      guard.handleKey(key, Date.now())
      vi.advanceTimersByTime(gapMs)
    }
  }

  it('un número apretado a mano agrega ese producto', () => {
    const onDigit = vi.fn()
    const guard = createDigitShortcutGuard(onDigit)
    guard.handleKey('3', Date.now())
    vi.advanceTimersByTime(150)
    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith(3)
  })

  it('un código escaneado no agrega ningún producto por posición', () => {
    const onDigit = vi.fn()
    const guard = createDigitShortcutGuard(onDigit)
    press(guard, '7840123456789', 5)
    guard.handleKey('Enter', Date.now())
    vi.advanceTimersByTime(500)
    expect(onDigit).not.toHaveBeenCalled()
  })

  it('después del escaneo, el atajo vuelve a funcionar tras una pausa', () => {
    const onDigit = vi.fn()
    const guard = createDigitShortcutGuard(onDigit)
    press(guard, '7891234', 5)
    vi.advanceTimersByTime(400)
    guard.handleKey('2', Date.now())
    vi.advanceTimersByTime(150)
    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith(2)
  })

  it('dos números seguidos a mano, con pausa, agregan los dos', () => {
    const onDigit = vi.fn()
    const guard = createDigitShortcutGuard(onDigit)
    press(guard, '12', 300)
    expect(onDigit.mock.calls.map(([digit]) => digit)).toEqual([1, 2])
  })

  it('el 0 y las letras no son atajo', () => {
    const onDigit = vi.fn()
    const guard = createDigitShortcutGuard(onDigit)
    press(guard, '0', 300)
    press(guard, 'a', 300)
    expect(onDigit).not.toHaveBeenCalled()
  })
})
