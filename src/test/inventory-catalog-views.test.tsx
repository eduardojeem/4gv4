import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogProductGrid, productMargin, stockFill } from '@/components/admin/inventory/CatalogProductGrid'
import { CatalogFirstSteps, CatalogGuide } from '@/components/admin/inventory/CatalogGuide'
import type { Product } from '@/hooks/use-inventory'

const PANTALLA = readFileSync(resolve(process.cwd(), 'src/components/admin/inventory/inventory-management.tsx'), 'utf8')

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Cargador USB-C', sku: 'CAR-001', sale_price: 45000, purchase_price: 28000,
  stock_quantity: 12, min_stock: 4, max_stock: 0, status: 'active', created_at: '', updated_at: '',
  category: { name: 'Cargadores' },
  ...overrides,
})

beforeEach(() => window.localStorage.clear())

describe('cuánto se llena la barra de stock', () => {
  it('usa el máximo si hay uno', () => {
    expect(stockFill({ stock_quantity: 10, min_stock: 2, max_stock: 40 })).toBe(25)
  })
  it('sin máximo, compara con tres veces el mínimo', () => {
    expect(stockFill({ stock_quantity: 6, min_stock: 4, max_stock: 0 })).toBe(50)
  })
  it('agotado es vacío y sin referencias es lleno', () => {
    expect(stockFill({ stock_quantity: 0, min_stock: 4, max_stock: 0 })).toBe(0)
    expect(stockFill({ stock_quantity: 3, min_stock: 0, max_stock: 0 })).toBe(100)
  })
})

describe('margen de cada producto', () => {
  it('sobre el precio de venta', () => {
    expect(productMargin({ sale_price: 50000, purchase_price: 30000 })).toBe(40)
  })
  it('sin costo no inventa un margen', () => {
    expect(productMargin({ sale_price: 50000, purchase_price: 0 })).toBeNull()
  })
})

describe('vista en tarjetas', () => {
  it('muestra precio, margen, stock y acciones de cada producto', () => {
    const onStock = vi.fn()
    render(<CatalogProductGrid products={[product()]} loading={false} onEdit={vi.fn()} onStock={onStock} onVariants={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Margen 38%')).toBeInTheDocument()
    expect(screen.getByText('12 u.')).toBeInTheDocument()
    expect(screen.getByText('Mínimo 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Stock/ }))
    expect(onStock).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })

  it('avisa cuando falta el costo o el mínimo', () => {
    render(<CatalogProductGrid products={[product({ purchase_price: 0, min_stock: 0 })]} loading={false} onEdit={vi.fn()} onStock={vi.fn()} onVariants={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Sin costo cargado')).toBeInTheDocument()
    expect(screen.getByText(/Sin mínimo: no avisa/)).toBeInTheDocument()
  })
})

describe('guía del catálogo', () => {
  it('arranca abierta, nombra la sucursal y recuerda si se pliega', () => {
    const { unmount } = render(<CatalogGuide branchName="Centro" onOpenFullGuide={vi.fn()} />)
    expect(screen.getByText(/La columna de stock es la de Centro/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cómo funciona el catálogo/ }))
    unmount()
    render(<CatalogGuide branchName="Centro" onOpenFullGuide={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Cómo funciona el catálogo/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('los primeros pasos tachan lo que ya está hecho', () => {
    render(<CatalogFirstSteps categories={2} suppliers={0} onAddSupplier={vi.fn()} onAddProduct={vi.fn()} />)
    expect(screen.getByLabelText('Listo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proveedores' })).toBeInTheDocument()
  })
})

describe('la pantalla ofrece las dos vistas', () => {
  it('recuerda la vista elegida y filtra el stock con chips', () => {
    expect(PANTALLA).toContain("const CATALOG_VIEW_KEY = 'mipos:inventory:catalog-view'")
    expect(PANTALLA).toContain("catalogView === 'grid' ?")
    expect(PANTALLA).toContain('<CatalogProductGrid')
    expect(PANTALLA).toContain('aria-label="Filtrar por stock"')
  })
})
