import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearProductDraft, readProductDraft, saveProductDraft } from './product-draft'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El modal guarda todo en estado de React: cualquier cosa que desmonte el árbol
 * —una recarga de la pestaña, un remonte del layout— borra lo que se estaba
 * cargando. Es lo que hace que alguien se vaya a otra ventana a copiar un dato y
 * al volver tenga que escribir el producto de nuevo.
 */
describe('borrador del producto', () => {
  beforeEach(() => { window.sessionStorage.clear() })
  afterEach(() => { vi.useRealTimers() })

  it('guarda y devuelve lo escrito', () => {
    saveProductDraft('p-1', { name: 'Teclado', sale_price: 90000 })
    expect(readProductDraft('p-1')).toEqual({ name: 'Teclado', sale_price: 90000 })
  })

  it('separa el borrador de cada producto y el de uno nuevo', () => {
    saveProductDraft('p-1', { name: 'Uno' })
    saveProductDraft('p-2', { name: 'Dos' })
    saveProductDraft(null, { name: 'Nuevo' })

    expect(readProductDraft('p-1')).toEqual({ name: 'Uno' })
    expect(readProductDraft('p-2')).toEqual({ name: 'Dos' })
    expect(readProductDraft(null)).toEqual({ name: 'Nuevo' })
  })

  it('no ofrece un borrador de otro momento', () => {
    // Recuperar algo de hace horas sin avisar es peor que no recuperar nada.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))
    saveProductDraft('p-1', { name: 'Viejo' })

    vi.setSystemTime(new Date('2026-09-04T11:00:01Z'))
    expect(readProductDraft('p-1')).toBeNull()
  })

  it('sí ofrece uno reciente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))
    saveProductDraft('p-1', { name: 'Reciente' })

    vi.setSystemTime(new Date('2026-09-04T10:30:00Z'))
    expect(readProductDraft('p-1')).toEqual({ name: 'Reciente' })
  })

  it('se borra explícitamente', () => {
    saveProductDraft('p-1', { name: 'x' })
    clearProductDraft('p-1')
    expect(readProductDraft('p-1')).toBeNull()
  })

  it('no rompe con contenido corrupto', () => {
    window.sessionStorage.setItem('product-draft:p-1', 'no es json')
    expect(readProductDraft('p-1')).toBeNull()
  })

  it('usa sessionStorage y no localStorage', () => {
    // En localStorage el borrador sobreviviría a cerrar el navegador y
    // reaparecerían borradores de la semana pasada como si fueran de recién.
    saveProductDraft('p-1', { name: 'x' })
    expect(window.sessionStorage.getItem('product-draft:p-1')).toBeTruthy()
    // El entorno de prueba devuelve undefined donde el navegador devuelve null:
    // lo que importa es que no quedó nada guardado ahí.
    expect(window.localStorage.getItem('product-draft:p-1')).toBeFalsy()
  })
})

describe('el modal ya no borra lo que se está escribiendo', () => {
  const modal = leer('src/components/dashboard/product-modal.tsx')

  it('resetea por identidad del producto, no por el objeto', () => {
    // `product` llega como prop y cualquier recarga de la lista lo reemplaza por
    // uno nuevo con los mismos datos: con el objeto en las dependencias, ese
    // reemplazo disparaba `form.reset()` sobre lo que la persona escribía.
    expect(modal).toContain('}, [productId, form])')
    expect(modal).not.toContain('}, [product, form])')
    expect(modal).toContain('const product = productRef.current')
  })

  it('el borrador gana sobre lo guardado al abrir', () => {
    const efecto = modal.slice(modal.indexOf('const draft = readProductDraft(productId)'))
    expect(efecto.slice(0, 200)).toContain('setDraftRestored(true)')
  })

  it('solo guarda mientras hay cambios sin guardar', () => {
    // Guardar siempre dejaría un borrador idéntico a lo guardado y la próxima
    // apertura avisaría de una recuperación que no recuperó nada.
    const efecto = modal.slice(modal.indexOf('if (!isDirty) return'))
    expect(efecto.slice(0, 300)).toContain('saveProductDraft(productId')
  })

  it('lo borra al guardar y al descartar', () => {
    const guardado = modal.slice(modal.indexOf('newlyUploadedImages.current.clear()\n      // Lo escrito'))
    expect(guardado.slice(0, 300)).toContain('clearProductDraft(productId)')

    const descarte = modal.slice(modal.indexOf('const discardChangesAndClose'))
    expect(descarte.slice(0, 500)).toContain('clearProductDraft(productId)')
  })

  it('avisa que recuperó, en vez de aparecer lleno sin explicación', () => {
    expect(modal).toContain('Recuperamos lo que estabas cargando')
    expect(modal).toContain('Esto no está guardado todavía')
    expect(modal).toContain('Descartar y usar lo guardado')
  })
})
