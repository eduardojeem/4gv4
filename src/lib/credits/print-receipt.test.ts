import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadPdfDocument, printPdfDocument } from './print-receipt'

/**
 * El boton "Imprimir" no hacia nada: ambas pantallas abrian el PDF con
 * `output('dataurlnewwindow')` DESPUES de un await, y al perderse el gesto del
 * usuario el navegador bloqueaba la ventana emergente. Sin ventana, sin error y
 * sin aviso. Estos casos fijan que la entrega no vuelva a depender de abrir una
 * ventana, y que un fallo se propague en vez de morir en silencio.
 */
function fakeDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    autoPrint: vi.fn(),
    output: vi.fn(() => new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
    save: vi.fn(),
    ...overrides,
  } as never
}

/** Simula el iframe disparando su onload apenas se le asigna el src. */
function autoResolveIframes() {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = original(tag)
    if (tag === 'iframe') {
      Object.defineProperty(el, 'src', {
        set() { queueMicrotask(() => el.onload?.(new Event('load'))) },
        get() { return '' },
        configurable: true,
      })
      Object.defineProperty(el, 'contentWindow', {
        value: { focus: vi.fn(), print: vi.fn() },
        configurable: true,
      })
    }
    return el
  })
}

describe('printPdfDocument', () => {
  afterEach(() => vi.restoreAllMocks())

  it('no abre ventanas: entrega por iframe', async () => {
    autoResolveIframes()
    const abrir = vi.fn()
    vi.stubGlobal('open', abrir)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()

    await printPdfDocument(fakeDoc())

    // Abrir una ventana tras un await es justo lo que bloquean los navegadores.
    expect(abrir).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('pide el PDF como blob y no como URL de datos', async () => {
    autoResolveIframes()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const doc = fakeDoc()

    await printPdfDocument(doc)

    // 'dataurlnewwindow' era el modo que abria la ventana bloqueada.
    expect((doc as never as { output: ReturnType<typeof vi.fn> }).output).toHaveBeenCalledWith('blob')
  })

  it('deja la orden de impresion dentro del PDF', async () => {
    autoResolveIframes()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const doc = fakeDoc()

    await printPdfDocument(doc)

    expect((doc as never as { autoPrint: ReturnType<typeof vi.fn> }).autoPrint).toHaveBeenCalled()
  })

  it('propaga el fallo en vez de terminar en silencio', async () => {
    // Es lo que permite avisar que el pago SI se registro aunque falle el papel.
    const doc = fakeDoc({ output: vi.fn(() => { throw new Error('sin memoria') }) })

    await expect(printPdfDocument(doc)).rejects.toThrow('sin memoria')
  })
})

describe('downloadPdfDocument', () => {
  it('agrega la extension cuando falta', () => {
    const doc = fakeDoc()
    downloadPdfDocument(doc, 'comprobante_REC-1')
    expect((doc as never as { save: ReturnType<typeof vi.fn> }).save).toHaveBeenCalledWith('comprobante_REC-1.pdf')
  })

  it('no la duplica cuando ya viene', () => {
    const doc = fakeDoc()
    downloadPdfDocument(doc, 'comprobante.pdf')
    expect((doc as never as { save: ReturnType<typeof vi.fn> }).save).toHaveBeenCalledWith('comprobante.pdf')
  })
})
