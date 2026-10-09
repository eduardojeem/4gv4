import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleProductDraft, flushProductDraft, clearProductDraft, readProductDraft } from '@/lib/products/product-draft'
afterEach(() => { clearProductDraft(null); vi.useRealTimers() })
describe('borrador sin escrituras por tecla', () => {
  it('agrupa cambios y conserva el último valor', () => {
    vi.useFakeTimers()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    scheduleProductDraft(null, { name: 'Ca' })
    scheduleProductDraft(null, { name: 'Cable' })
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(350)
    expect(readProductDraft(null)).toEqual({ name: 'Cable' })
    expect(write).toHaveBeenCalledTimes(1)
    write.mockRestore()
  })
  it('descartar cancela el guardado pendiente', () => {
    vi.useFakeTimers()
    scheduleProductDraft(null, { name: 'Borrador' })
    clearProductDraft(null)
    vi.advanceTimersByTime(350)
    expect(readProductDraft(null)).toBeNull()
  })
  it('salir guarda el cambio pendiente sin esperar el temporizador', () => {
    vi.useFakeTimers()
    scheduleProductDraft(null, { name: 'Cable' })
    flushProductDraft(null)
    expect(readProductDraft(null)).toEqual({ name: 'Cable' })
  })
})
