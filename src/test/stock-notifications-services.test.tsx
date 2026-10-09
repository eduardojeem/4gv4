import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { useNotifications } from '@/components/dashboard/notification-system'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

describe('avisos de stock en la campanita del panel', () => {
  it('los servicios no cuentan como productos sin stock', () => {
    const header = leer('src/components/dashboard/header.tsx')
    expect(header).toContain("const physical = (data ?? []).filter((product) => !isServiceLikeProduct(product))")
    expect(header).toContain("select('id, name, sku, unit_measure, stock_quantity, min_stock')")
  })

  it('«Ver agotados» y «Ver productos» llevan a la lista filtrada', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => result.current.generateStockNotifications([{ stock_quantity: 0, min_stock: 0 }, { stock_quantity: 1, min_stock: 3 }]))
    const out = result.current.notifications.find((item) => item.title === 'Productos Agotados')
    const low = result.current.notifications.find((item) => item.title === 'Stock Bajo Detectado')
    expect(out?.message).toBe('1 producto sin stock')
    act(() => out?.action?.onClick())
    expect(push).toHaveBeenCalledWith('/dashboard/products?filter=out_of_stock')
    act(() => low?.action?.onClick())
    expect(push).toHaveBeenCalledWith('/dashboard/products?filter=low_stock')
  })

  it('sin productos físicos agotados, borra el aviso viejo', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => result.current.generateStockNotifications([{ stock_quantity: 0, min_stock: 0 }]))
    expect(result.current.notifications).toHaveLength(1)
    act(() => result.current.generateStockNotifications([]))
    expect(result.current.notifications.filter((item) => item.category === 'stock')).toHaveLength(0)
  })

  it('la lista de productos abre filtrada desde el aviso', () => {
    expect(leer('src/app/dashboard/products/page.tsx')).toContain('if (filter === "low_stock" || filter === "out_of_stock")')
  })
})
