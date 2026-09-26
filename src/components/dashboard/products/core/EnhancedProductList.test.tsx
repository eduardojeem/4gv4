import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/dashboard/products/core/EnhancedProductList.tsx'), 'utf8')

describe('EnhancedProductList contract', () => {
  it('consume los hooks públicos vigentes de productos', () => {
    expect(SOURCE).toContain('useProductManagement()')
    expect(SOURCE).toContain('useProductFiltering(products)')
  })

  it('tolera un estado de carga todavía no inicializado', () => {
    expect(SOURCE).toContain('if (loadingState?.loading)')
  })

  it('mantiene las vistas de tabla y cuadrícula', () => {
    expect(SOURCE).toContain("viewMode = 'table'")
    expect(SOURCE).toContain("localViewMode === 'grid'")
    expect(SOURCE).toContain("localViewMode === 'table'")
  })

  it('canaliza acciones individuales y masivas sin duplicar su lógica', () => {
    expect(SOURCE).toContain("onProductAction?.(action, product)")
    expect(SOURCE).toContain('onBulkAction?.(action, selectedProducts)')
    expect(SOURCE).toContain('clearSelection()')
  })
})
