/**
 * Regresión rules-of-hooks para la página de proveedores.
 *
 * Misma clase de bug que RepairSuccessDialog: si un guard con `return`
 * temprano queda por encima de los hooks, el primer render (estado de carga)
 * ejecuta menos hooks que el render ya resuelto, y React tira
 * "Rendered more hooks than during the previous render".
 *
 * Lo que reproduce el crash es el rerender estado-inicial -> estado-resuelto,
 * no un render aislado. Por eso el test renderiza primero en carga y después
 * hace rerender con los datos ya cargados.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UISupplier } from '@/lib/types/supplier-ui'

// --- Stubs de los hijos pesados: el objetivo es el orden de hooks de la
// --- página, no el árbol de UI completo.
vi.mock('@/components/dashboard/supplier-modal', () => ({
  SupplierModal: () => null,
}))
vi.mock('@/components/suppliers/SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}))
vi.mock('@/components/suppliers/FilterTags', () => ({
  FilterTags: () => <div data-testid="filter-tags" />,
}))
vi.mock('@/components/suppliers/SupplierGrid', () => ({
  SupplierGrid: ({ suppliers }: { suppliers: UISupplier[] }) => (
    <div data-testid="supplier-grid">{suppliers.length}</div>
  ),
}))
vi.mock('@/components/suppliers/SupplierList', () => ({
  SupplierList: ({ suppliers }: { suppliers: UISupplier[] }) => (
    <div data-testid="supplier-list">{suppliers.length}</div>
  ),
}))
vi.mock('@/components/suppliers/EmptyState', () => ({
  NoSuppliersFound: () => <div data-testid="no-suppliers" />,
  NoSearchResults: () => <div data-testid="no-results" />,
}))
vi.mock('@/components/suppliers/SupplierFilters', () => ({
  SupplierFilters: () => <div data-testid="supplier-filters" />,
}))
vi.mock('@/components/suppliers/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPalette: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
  }),
}))
vi.mock('@/lib/utils/export-suppliers', () => ({
  exportSuppliers: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Upstream agrego auth a la pagina: el guard de authLoading/canAccess es
// justamente lo que dispara el bug de hooks al resolverse.
const useAuthMock = vi.fn()
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}))

const useSuppliersMock = vi.fn()
vi.mock('@/hooks/use-suppliers', () => ({
  useSuppliers: () => useSuppliersMock(),
}))

const useSupplierSystemMock = vi.fn()
vi.mock('@/lib/integrations/inventory-suppliers', () => ({
  useSupplierSystem: () => useSupplierSystemMock(),
}))

import SuppliersPage from '../page'

const supplier: UISupplier = {
  id: 'sup-1',
  name: 'Proveedor Uno',
  status: 'active',
} as UISupplier

function suppliersState(overrides: Record<string, unknown> = {}) {
  return {
    suppliers: [],
    loading: true,
    stats: null,
    statsLoading: true,
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    deleteSupplier: vi.fn(),
    bulkDeleteSuppliers: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    refresh: vi.fn(),
    pagination: { page: 1, pageSize: 12, total: 0 },
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    ...overrides,
  }
}

describe('SuppliersPage - rules of hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 1er render: auth sin resolver -> solo corren los hooks previos al guard.
    useAuthMock.mockReturnValue({ user: null, isAdmin: false, loading: true })
    useSupplierSystemMock.mockReturnValue({
      loading: true,
      suppliers: [],
      syncAllSuppliers: vi.fn(),
    })
  })

  it('sobrevive el rerender de estado de carga a estado resuelto con datos', () => {
    // 1er render: todo cargando, sin datos.
    useSuppliersMock.mockReturnValue(suppliersState())

    const { rerender } = render(<SuppliersPage />)
    // Mientras auth no resuelve solo se ve el guard, no la pagina.
    expect(screen.getByText(/Verificando permisos/i)).toBeInTheDocument()
    expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument()

    // 2do render: auth/datos resueltos. Este es el paso que hacía que React
    // contara un número distinto de hooks y tirara el error.
    useSuppliersMock.mockReturnValue(
      suppliersState({
        suppliers: [supplier],
        loading: false,
        statsLoading: false,
        stats: {
          total: 1,
          active: 1,
          inactive: 0,
          pending: 0,
          totalProducts: 4,
          totalValue: 1000,
        },
        pagination: { page: 1, pageSize: 12, total: 1 },
      })
    )
    // Auth resuelve como admin: el componente pasa ambos guards y llama los
    // 17 hooks restantes. Este es el paso que hacia crashear a React.
    useAuthMock.mockReturnValue({ user: { role: 'admin' }, isAdmin: true, loading: false })
    useSupplierSystemMock.mockReturnValue({
      loading: false,
      suppliers: ['integracion-a'],
      syncAllSuppliers: vi.fn(),
    })

    expect(() => rerender(<SuppliersPage />)).not.toThrow()

    // La página quedó renderizada, no crasheada.
    expect(screen.getByTestId('search-bar')).toBeInTheDocument()
    expect(screen.getByTestId('supplier-grid')).toHaveTextContent('1')
  })

  it('renderiza directamente en estado resuelto sin romper', () => {
    useSuppliersMock.mockReturnValue(
      suppliersState({
        suppliers: [supplier],
        loading: false,
        statsLoading: false,
        stats: {
          total: 1,
          active: 1,
          inactive: 0,
          pending: 0,
          totalProducts: 4,
          totalValue: 1000,
        },
        pagination: { page: 1, pageSize: 12, total: 1 },
      })
    )
    useAuthMock.mockReturnValue({ user: { role: 'admin' }, isAdmin: true, loading: false })
    useSupplierSystemMock.mockReturnValue({
      loading: false,
      suppliers: [],
      syncAllSuppliers: vi.fn(),
    })

    expect(() => render(<SuppliersPage />)).not.toThrow()
    expect(screen.getByTestId('supplier-grid')).toHaveTextContent('1')
  })
})
