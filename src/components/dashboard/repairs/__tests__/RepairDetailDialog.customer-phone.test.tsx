import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RepairDetailDialog } from '../RepairDetailDialog'
import type { Repair } from '@/types/repairs'

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mockToast.success(msg),
    error: (msg: string) => mockToast.error(msg),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    isAdmin: true,
    hasPermission: () => true,
    user: { id: 'u1', role: 'admin' },
    profile: { id: 'u1', role: 'admin' },
  }),
}))

vi.mock('@/hooks/use-shared-settings', () => ({
  useSharedSettings: () => ({ settings: {} }),
}))

vi.mock('@/components/dashboard/after-sales/CreateAfterSalesCaseDialog', () => ({
  CreateAfterSalesCaseDialog: () => null,
}))

vi.mock('../RepairWarrantyCase', () => ({ RepairWarrantyCase: () => null }))

const sampleRepair: Repair = {
  id: 'rep-123',
  ticketNumber: 'TICK-001',
  device: 'Samsung S21',
  deviceType: 'smartphone',
  brand: 'Samsung',
  model: 'S21',
  issue: 'Pantalla rota',
  description: 'Cambio de módulo',
  status: 'listo',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 250000,
  finalCost: 250000,
  laborCost: 100000,
  parts: [],
  notes: [],
  images: [],
  customer: {
    id: 'cust-1',
    name: 'Juan Pérez',
    phone: '0981111222',
    alternate_phone: '0983333444',
    alternate_phone_label: 'Esposa',
    email: 'juan@example.com',
    ruc: '1234567-8',
  },
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T12:00:00Z',
}

describe('RepairDetailDialog Customer Alternate Phone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.open = vi.fn().mockReturnValue(true)
    class ResizeObserverMock {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('renders primary phone and alternate phone with its label in customer card', () => {
    render(
      <RepairDetailDialog
        repair={sampleRepair}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    // Check customer name and RUC
    expect(screen.getAllByText('Juan Pérez')[0]).toBeInTheDocument()
    expect(screen.getByText(/RUC\/CI: 1234567-8/i)).toBeInTheDocument()

    // Check primary phone
    expect(screen.getByText('0981111222')).toBeInTheDocument()
    expect(screen.getByText('Principal')).toBeInTheDocument()

    // Check alternate phone
    expect(screen.getAllByText('0983333444')[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Esposa/i)[0]).toBeInTheDocument()

    // Check WhatsApp buttons
    expect(screen.getByRole('button', { name: /Avisar estado por WhatsApp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avisar a Esposa/i })).toBeInTheDocument()

    // Check Autorizados section
    expect(screen.getByText(/Autorizados para retiro/i)).toBeInTheDocument()
  })

  it('triggers WhatsApp with alternate phone when clicking alternate notification button', () => {
    render(
      <RepairDetailDialog
        repair={sampleRepair}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const altWhatsAppBtn = screen.getByRole('button', { name: /Avisar a Esposa/i })
    fireEvent.click(altWhatsAppBtn)

    expect(window.open).toHaveBeenCalled()
    const openUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(openUrl).toContain('983333444')
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Esposa'))
  })
})
