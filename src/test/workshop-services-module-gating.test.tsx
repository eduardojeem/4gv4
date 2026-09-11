import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { QuickFiltersBar } from '@/components/dashboard/products-modern/QuickFiltersBar'
import { MetricsGrid } from '@/components/dashboard/products-modern/MetricsGrid'
import { POSShortcutsBar } from '@/app/dashboard/pos/components/POSShortcutsBar'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Verifica que `cond` envuelva el bloque que contiene `texto`: la condicion
 * tiene que aparecer poco antes del texto. Se busca el bloque real, no un
 * comentario que lo mencione.
 */
function envuelto(fuente: string, cond: string, texto: string, distancia = 900) {
  const i = fuente.indexOf(texto)
  expect(i, `no se encontró «${texto}»`).toBeGreaterThan(-1)
  const tramo = fuente.slice(Math.max(0, i - distancia), i)
  expect(tramo, `«${texto}» no está dentro de «${cond}»`).toContain(cond)
}

/**
 * El menu lateral y el menu movil ocultaban «Reparaciones» sin el modulo de
 * taller, pero el resto del sistema no: el POS ofrecia «Cobrar Reparación», la
 * ficha del cliente tenia «Nueva Reparación» y una pestaña con «0
 * reparaciones», y posventa dejaba reclamar contra una reparacion que no
 * existe.
 */
describe('POS sin taller', () => {
  const page = leer('src/app/dashboard/pos/page.tsx')

  it('lee el módulo con la misma regla que el menú', () => {
    expect(page).toContain("const repairsEnabled = effectiveModules.includes('repairs')")
  })

  it('no consulta las reparaciones del cliente', () => {
    expect(page).toContain('enabled: repairsEnabled,')
    expect(leer('src/app/dashboard/pos/hooks/usePOSRepairs.ts')).toContain('if (!selectedCustomer || !enabled) {')
  })

  it('ninguno de los accesos a «Cobrar Reparación» aparece', () => {
    envuelto(page, '{repairsEnabled && (', 'Cobrar Reparación / Taller')
    expect(page.match(/onOpenRepairModal=\{repairsEnabled \? /g)).toHaveLength(3)
    expect(page).not.toContain('onOpenRepairModal={() =>')
    expect(page).toContain('open={repairsEnabled && isRepairModalOpen}')
  })

  it('un ?repairId= en la URL o una venta en espera no cargan reparaciones', () => {
    expect(page).toContain('if (rid && repairsEnabled) setSelectedRepairIds([rid])')
    expect(page).toContain('if (repairsEnabled && Array.isArray(sale.selectedRepairIds)')
  })

  it('el checkout no ofrece vincular la venta a una reparación', () => {
    expect(page).toContain('repairsEnabled={repairsEnabled}')
    expect(leer('src/app/dashboard/pos/components/CheckoutModal.tsx')).toContain('{repairsEnabled && selectedCustomer && (')
  })

  it('la barra de atajos no muestra el botón si no recibe la acción', () => {
    const props = {
      onFocusSearch: vi.fn(),
      onOpenCustomer: vi.fn(),
      onCheckout: vi.fn(),
      onHoldSale: vi.fn(),
      onOpenHeldSales: vi.fn(),
      heldSalesCount: 0,
      onToggleWholesale: vi.fn(),
      isWholesale: false,
      onClearCart: vi.fn(),
      canCheckout: true,
      cartItemCount: 0,
    }
    const { unmount } = render(<POSShortcutsBar {...(props as never)} />)
    expect(screen.queryByText('Cobrar Reparación')).not.toBeInTheDocument()
    unmount()

    render(<POSShortcutsBar {...(props as never)} onOpenRepairModal={vi.fn()} />)
    expect(screen.getByText('Cobrar Reparación')).toBeInTheDocument()
  })
})

describe('clientes sin taller', () => {
  it('la ficha no ofrece «Nueva Reparación»', () => {
    envuelto(leer('src/components/dashboard/customers/CustomerDetailHeader.tsx'), '{tieneTaller && (', '<span>Nueva Reparación</span>')
  })

  it('el historial oculta la tarjeta, el filtro y la pestaña de reparaciones', () => {
    const history = leer('src/components/dashboard/customers/CustomerHistory.tsx')
    envuelto(history, '{tieneTaller && (', '>Total Reparaciones</p>')
    expect(history).toContain('{tieneTaller && <SelectItem value="repair">Reparaciones</SelectItem>}')
    envuelto(history, '{tieneTaller && (', 'Reparaciones ({repairRecords.length})')
    envuelto(history, '{tieneTaller && (', '{repairRecords.length} reparaciones</Badge>')
    // Las grillas se ajustan para no dejar un hueco.
    expect(history).toContain("tieneTaller ? 'grid-cols-4' : 'grid-cols-3'")
  })

  it('la vista rápida ni consulta ni muestra reparaciones', () => {
    const quick = leer('src/components/dashboard/customers/CustomerQuickView.tsx')
    expect(quick).toContain('if (tieneTaller) fetchRepairs()')
    expect(quick).toContain("tieneTaller ? 'sm:grid-cols-5' : 'sm:grid-cols-4'")
    envuelto(quick, '{tieneTaller && (', '<p className="text-[11px] font-medium text-slate-500">Reparaciones</p>')
    envuelto(quick, '{tieneTaller && (', '<span>Reparaciones</span>')
  })
})

describe('posventa sin taller', () => {
  it('no se puede reclamar contra una reparación', () => {
    expect(leer('src/components/dashboard/after-sales/CreateAfterSalesCaseDialog.tsx')).toContain(
      ".filter((option) => option.value !== 'repair' || tieneTaller)"
    )
    envuelto(
      leer('src/components/dashboard/after-sales/SourcesBrowser.tsx'),
      '{tieneTaller && (',
      "variant={sourceType === 'repair' ? 'default' : 'ghost'}"
    )
  })
})

/**
 * Servicios: se ofrecen si la organizacion tiene el modulo o ya cargo
 * servicios. No se esconden datos que existen.
 */
describe('productos sin servicios', () => {
  it('la página decide con el módulo o con los servicios que ya existen', () => {
    const page = leer('src/app/dashboard/products/page.tsx')
    expect(page).toContain('const hasServicesModule = effectiveModules.includes("services");')
    expect(page.match(/showServices=\{hasServicesModule \|\| \(globalMetrics\.services_count \?\? 0\) > 0\}/g)).toHaveLength(4)
  })

  it('el filtro rápido «Solo Servicios» desaparece', () => {
    const { unmount } = render(<QuickFiltersBar {...({ products: [], onFilterClick: vi.fn() } as never)} showServices={false} />)
    expect(screen.queryByText('Solo Servicios')).not.toBeInTheDocument()
    unmount()

    render(<QuickFiltersBar {...({ products: [], onFilterClick: vi.fn() } as never)} />)
    expect(screen.getByText('Solo Servicios')).toBeInTheDocument()
  })

  it('el catálogo no desglosa «0 servicios»', () => {
    const metrics = {
      total_products: 12,
      physical_products_count: 12,
      services_count: 0,
      inventory_value: 1_000_000,
      low_stock_count: 0,
      out_of_stock_count: 0,
      active_products: 12,
    }
    const { unmount } = render(<MetricsGrid metrics={metrics as never} showServices={false} />)
    expect(screen.getByText('12 productos')).toBeInTheDocument()
    expect(screen.queryByText(/servicios/)).not.toBeInTheDocument()
    unmount()

    render(<MetricsGrid metrics={metrics as never} />)
    expect(screen.getByText('12 productos · 0 servicios')).toBeInTheDocument()
  })

  it('el panel de filtros y el agrupador tampoco ofrecen servicios', () => {
    expect(leer('src/components/dashboard/products-modern/FilterPanel.tsx')).toContain(
      '{showServices && <SelectItem value="services">⚙️ Solo Servicios</SelectItem>}'
    )
    envuelto(leer('src/components/dashboard/products-modern/GroupBySelector.tsx'), '{showServices && (', 'Por Tipo (Productos / Servicios)')
    expect(leer('src/components/dashboard/products-modern/SearchAndActionsBar.tsx')).toContain('showServices={showServices}')
  })
})

describe('menú de admin', () => {
  it('filtra con los módulos efectivos, no con los del plan', () => {
    // Pasaba los del plan: Analítica, Inventario avanzado o Seguridad seguían
    // en el menú aunque la organización los hubiera apagado.
    const layout = leer('src/components/admin/layout/AdminLayout.tsx')
    expect(layout).toContain('filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin, isSuperAdmin, effectiveModules)')
    expect(layout).not.toContain('modules: planModules')
  })
})
