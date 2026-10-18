import { describe, expect, it } from 'vitest'
import type { GlobalCategory } from './global-catalog'
import { planGlobalImport, withAncestors } from './global-import'

const catalog: GlobalCategory[] = [
  { id: 'cel', name: 'Celulares', slug: 'celulares', parent_id: null },
  { id: 'acc-cel', name: 'Accesorios', slug: 'accesorios-celulares', parent_id: 'cel' },
  { id: 'fundas', name: 'Fundas', slug: 'fundas', parent_id: 'acc-cel' },
  { id: 'ropa', name: 'Ropa', slug: 'ropa', parent_id: null },
  { id: 'acc-ropa', name: 'Accesorios', slug: 'accesorios-ropa', parent_id: 'ropa' },
]

describe('agregar categorías del catálogo global', () => {
  it('suma los padres de lo elegido, padres primero', () => {
    expect(withAncestors(['fundas'], catalog).map((category) => category.id)).toEqual(['cel', 'acc-cel', 'fundas'])
  })

  it('crea lo que falta con su padre en el catálogo', () => {
    expect(planGlobalImport(['acc-cel'], catalog, [])).toEqual([
      { kind: 'create', globalId: 'cel', name: 'Celulares', parentGlobalId: null },
      { kind: 'create', globalId: 'acc-cel', name: 'Accesorios', parentGlobalId: 'cel' },
    ])
  })

  it('no duplica lo que ya está vinculado y vincula la del mismo nombre', () => {
    const plan = planGlobalImport(['acc-cel'], catalog, [
      { id: 'l1', name: 'Celulares', parent_id: null, global_category_id: 'cel' },
      { id: 'l2', name: 'accesorios', parent_id: null, global_category_id: null },
    ])
    expect(plan).toEqual([
      { kind: 'present', globalId: 'cel', localId: 'l1', name: 'Celulares' },
      { kind: 'link', globalId: 'acc-cel', localId: 'l2', name: 'accesorios' },
    ])
  })

  it('si el nombre ya es de otra categoría vinculada, lo aclara con el padre', () => {
    const plan = planGlobalImport(['acc-ropa'], catalog, [
      { id: 'l1', name: 'Accesorios', parent_id: null, global_category_id: 'acc-cel' },
    ])
    expect(plan.find((step) => step.globalId === 'acc-ropa')).toEqual(
      { kind: 'create', globalId: 'acc-ropa', name: 'Accesorios (Ropa)', parentGlobalId: 'ropa' }
    )
  })
})
