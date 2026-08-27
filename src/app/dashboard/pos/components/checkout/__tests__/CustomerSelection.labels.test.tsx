import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CustomerSelection } from '../CustomerSelection'

type PosCustomer = {
  id: string
  name: string
  type?: string
  phone?: string
  email?: string
}

const customerState = {
  selectedCustomer: '',
  activeCustomer: null as PosCustomer | null,
  customers: [] as PosCustomer[],
  filteredCustomers: [] as PosCustomer[],
  customerTypes: [] as string[],
}

vi.mock('../../../contexts/POSCustomerContext', () => ({
  usePOSCustomer: () => ({
    ...customerState,
    setSelectedCustomer: vi.fn(),
    setCustomers: vi.fn(),
    setCustomersSourceSupabase: vi.fn(),
    setLastCustomerRefreshCount: vi.fn(),
    customerSearch: '',
    setCustomerSearch: vi.fn(),
    customerTypeFilter: 'all',
    setCustomerTypeFilter: vi.fn(),
    showFrequentOnly: false,
    setShowFrequentOnly: vi.fn(),
    lastCustomerRefreshCount: null,
    refreshCustomers: vi.fn().mockResolvedValue(undefined),
    newCustomerOpen: false,
    setNewCustomerOpen: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-credit-system', () => ({
  useCreditSystem: () => ({ loadCreditData: vi.fn() }),
}))

function renderSelection() {
  return render(
    <CustomerSelection
      showCreditHistory={false}
      setShowCreditHistory={vi.fn()}
      formatCurrency={(n: number) => `Gs. ${n}`}
    />,
  )
}

beforeAll(() => {
  // Radix Select usa APIs de puntero que jsdom no implementa.
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('CustomerSelection — tipo de cliente en el modal de cobro', () => {
  it('lista los clientes con el tipo en español, no en inglés', async () => {
    // Reporte del usuario: la opcion decia "Distribuidora Sur · wholesale" y
    // ese mismo texto quedaba en el selector al elegir el cliente.
    customerState.activeCustomer = null
    customerState.filteredCustomers = [
      { id: 'c-1', name: 'Distribuidora Sur', type: 'wholesale' },
    ]
    customerState.customerTypes = []

    renderSelection()
    // El unico combobox con etiqueta es el filtro por tipo; el otro es el de clientes.
    const combos = screen.getAllByRole('combobox')
    await userEvent.click(combos[combos.length - 1])

    expect(screen.getByText(/Distribuidora Sur · Mayorista/)).toBeInTheDocument()
    expect(screen.queryByText(/wholesale/)).toBeNull()
  })

  it('traduce también las opciones del filtro por tipo', async () => {
    customerState.activeCustomer = null
    customerState.filteredCustomers = []
    customerState.customerTypes = ['wholesale', 'vip']

    renderSelection()
    await userEvent.click(screen.getByLabelText('Filtrar por tipo de cliente'))

    expect(screen.getByText('Mayorista')).toBeInTheDocument()
    expect(screen.queryByText('wholesale')).toBeNull()
  })

  it('marca como Mayorista al cliente guardado en inglés', () => {
    customerState.activeCustomer = { id: 'c-1', name: 'Distribuidora Sur', type: 'wholesale' }
    customerState.filteredCustomers = []

    renderSelection()

    expect(screen.getByText('Mayorista')).toBeInTheDocument()
  })

  it('y también al guardado en español, que antes se quedaba sin la chapa', () => {
    // El formulario de clientes guarda 'mayorista'; el cobro comparaba contra
    // 'wholesale', asi que ese cliente no recibia ninguna marca.
    customerState.activeCustomer = { id: 'c-2', name: 'Kiosco Norte', type: 'mayorista' }
    customerState.filteredCustomers = []

    renderSelection()

    expect(screen.getByText('Mayorista')).toBeInTheDocument()
  })
})
