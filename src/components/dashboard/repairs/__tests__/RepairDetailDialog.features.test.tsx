import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  useSharedSettings: () => ({ settings: { currency: 'PYG' } }),
}))

vi.mock('@/components/dashboard/after-sales/CreateAfterSalesCaseDialog', () => ({
  CreateAfterSalesCaseDialog: () => null,
}))

vi.mock('../RepairWarrantyCase', () => ({ RepairWarrantyCase: () => null }))

const sampleRepair: Repair = {
  id: 'rep-test-1',
  ticketNumber: 'TICK-999',
  device: 'iPhone 13',
  deviceType: 'smartphone',
  brand: 'Apple',
  model: 'iPhone 13',
  issue: 'Sin encendido tras caída',
  description: 'Revisión inicial de placa y batería',
  status: 'diagnostico',
  priority: 'high',
  urgency: 'urgent',
  estimatedCost: 350000,
  finalCost: 350000,
  laborCost: 150000,
  warrantyMonths: 3,
  parts: [],
  notes: [],
  images: [
    {
      id: 'img-1',
      url: 'https://example.com/photo1.jpg',
      description: 'Estado inicial del chasis',
    }
  ],
  customer: {
    id: 'cust-1',
    name: 'Carlos Ruiz',
    phone: '0981123456',
    email: 'carlos@example.com',
  },
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T12:00:00Z',
}

describe('RepairDetailDialog new features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.open = vi.fn().mockReturnValue(true)
    class ResizeObserverMock {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
    window.ResizeObserver = ResizeObserverMock
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('muestra la sección de técnico marcada en rojo con advertencia cuando falta asignar técnico', () => {
    render(
      <RepairDetailDialog
        open
        repair={sampleRepair}
        onClose={vi.fn()}
        onTechnicianChange={vi.fn().mockResolvedValue(true)}
        technicians={[{ id: 'tech-1', name: 'Laura Gómez' }]}
      />
    )

    const technicianSectionBadges = screen.getAllByText(/técnico requerido/i)
    expect(technicianSectionBadges.length).toBeGreaterThan(0)

    const assignBtn = screen.getByRole('button', { name: /asignar técnico/i })
    expect(assignBtn).toBeInTheDocument()
  })

  it('permite editar la Descripción Detallada y guardarla inline', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/repairs/rep-test-1') && opts?.method === 'PATCH') {
        const body = JSON.parse(opts.body as string)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            repair: {
              ...sampleRepair,
              description: body.description,
            },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    })
    global.fetch = fetchMock

    render(
      <RepairDetailDialog
        open
        repair={sampleRepair}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Revisión inicial de placa y batería')).toBeInTheDocument()

    const editBtn = screen.getByRole('button', { name: 'Editar descripción detallada' })
    fireEvent.click(editBtn)

    const textarea = screen.getByPlaceholderText(/ingresá la descripción detallada/i)
    expect(textarea).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'Batería sulfatada reemplazada y prueba ok' } })

    const saveBtn = screen.getByRole('button', { name: /guardar descripción/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Descripción detallada actualizada correctamente')
    })
  })

  it('muestra la pestaña de imágenes con contador y opción de cargar imagen', async () => {
    const user = userEvent.setup()
    render(
      <RepairDetailDialog
        open
        repair={sampleRepair}
        onClose={vi.fn()}
      />
    )

    const imagesTab = screen.getByRole('tab', { name: /imágenes \(1\)/i })
    expect(imagesTab).toBeInTheDocument()

    await user.click(imagesTab)

    const uploadBtn = screen.getByRole('button', { name: /cargar imagen/i })
    expect(uploadBtn).toBeInTheDocument()

    await user.click(uploadBtn)
    expect(screen.getByText(/subir foto a la reparación/i)).toBeInTheDocument()
  })

  it('muestra "+ Productos en POS" solo cuando la reparación está en estado listo', () => {
    const { rerender } = render(
      <RepairDetailDialog
        open
        repair={{ ...sampleRepair, status: 'diagnostico' }}
        onClose={vi.fn()}
      />
    )

    // En diagnóstico no debe aparecer
    expect(screen.queryByRole('button', { name: /\+ productos en pos/i })).not.toBeInTheDocument()

    // Cuando pasa a listo, debe estar disponible
    rerender(
      <RepairDetailDialog
        open
        repair={{ ...sampleRepair, status: 'listo' }}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /\+ productos en pos/i })).toBeInTheDocument()
  })

  it('adapta el texto del botón de pago según el estado de la reparación y adelantos previos', () => {
    // 1. En diagnóstico sin pagos: "Registrar adelanto"
    const { rerender } = render(
      <RepairDetailDialog
        open
        repair={{ ...sampleRepair, status: 'diagnostico', paidAmount: 0 }}
        onClose={vi.fn()}
        onQuickPay={vi.fn()}
      />
    )
    expect(screen.getAllByRole('button', { name: /registrar adelanto/i })[0]).toBeInTheDocument()

    // 2. En reparación con adelanto previo: "Registrar pago a cuenta"
    rerender(
      <RepairDetailDialog
        open
        repair={{ ...sampleRepair, status: 'reparacion', paidAmount: 100000 }}
        onClose={vi.fn()}
        onQuickPay={vi.fn()}
      />
    )
    expect(screen.getAllByRole('button', { name: /registrar pago a cuenta/i })[0]).toBeInTheDocument()

    // 3. Cuando está listo: "Cobrar saldo"
    rerender(
      <RepairDetailDialog
        open
        repair={{ ...sampleRepair, status: 'listo', paidAmount: 100000 }}
        onClose={vi.fn()}
        onQuickPay={vi.fn()}
      />
    )
    expect(screen.getAllByRole('button', { name: /cobrar saldo/i })[0]).toBeInTheDocument()
  })

  it('confirma la prueba aprobada en vez de mostrar el aviso genérico de equipo listo', () => {
    render(
      <RepairDetailDialog
        open
        repair={{
          ...sampleRepair,
          status: 'listo',
          qualityCheck: {
            id: 'quality-1',
            result: 'passed',
            checklist: {
              powersOn: true,
              reportedIssueResolved: true,
              basicFunctions: true,
              physicalCondition: true,
              accessoriesVerified: true,
            },
            note: null,
            checkedBy: { id: 'tech-1', name: 'Laura Gómez' },
            checkedAt: '2026-09-13T20:00:00Z',
          },
        }}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Funcionamiento verificado')).toBeInTheDocument()
    expect(screen.getByText(/superó la prueba técnica/i)).toBeInTheDocument()
    expect(screen.queryByText('Equipo Listo para Entrega')).not.toBeInTheDocument()
  })

  it('resalta en rojo un retiro sin reparación dentro del detalle', () => {
    render(
      <RepairDetailDialog
        open
        repair={{
          ...sampleRepair,
          status: 'listo',
          qualityCheck: {
            id: 'quality-unrepairable',
            result: 'unrepairable',
            checklist: {
              powersOn: false,
              reportedIssueResolved: false,
              basicFunctions: false,
              physicalCondition: true,
              accessoriesVerified: true,
            },
            note: 'No fue posible reparar la placa.',
            checkedAt: '2026-09-13T20:00:00Z',
          },
        }}
        onClose={vi.fn()}
      />
    )

    const title = screen.getByText('Retiro sin reparación confirmado')
    expect(title.closest('[role="status"]')).toHaveClass('border-rose-200')
  })
})
