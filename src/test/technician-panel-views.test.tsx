import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TechnicianGuideDialog } from '@/components/technician/TechnicianGuideDialog'
import { TechnicianListView } from '@/components/technician/TechnicianListView'
import { RepairCardsView } from '@/components/dashboard/repairs/RepairCardsView'
import type { Repair } from '@/types/repairs'

const mockRepairs: Repair[] = [
  {
    id: 'rep-101',
    ticketNumber: 'REP-1042',
    device: 'Samsung S22 Ultra',
    deviceType: 'smartphone',
    brand: 'Samsung',
    model: 'S22 Ultra',
    issue: 'No enciende tras caer al agua',
    description: 'Sulfato en pin de carga',
    status: 'diagnostico',
    dbStatus: 'diagnostico',
    priority: 'high',
    urgency: 'urgent',
    estimatedCost: 350000,
    finalCost: null,
    accessType: 'pin',
    accessPassword: '1234',
    customer: {
      id: 'cust-1',
      name: 'Juan Pérez',
      phone: '0981123456',
      email: 'juan@example.com',
    },
    technician: {
      id: 'tech-1',
      name: 'Carlos Gómez',
    },
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(), // 2 hours ago
    updatedAt: new Date().toISOString(),
    parts: [],
    notes: [],
    images: [],
  },
  {
    id: 'rep-102',
    ticketNumber: 'REP-1043',
    device: 'iPhone 13 Pro',
    deviceType: 'smartphone',
    brand: 'Apple',
    model: '13 Pro',
    issue: 'Batería degradada 72%',
    description: 'Cambio de batería original',
    status: 'listo',
    dbStatus: 'listo',
    priority: 'medium',
    urgency: 'normal',
    estimatedCost: 450000,
    finalCost: 450000,
    accessType: 'none',
    customer: {
      id: 'cust-2',
      name: 'María Silva',
      phone: '0971987654',
      email: 'maria@example.com',
    },
    technician: {
      id: 'tech-1',
      name: 'Carlos Gómez',
    },
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
    parts: [],
    notes: [],
    images: [],
  },
]

describe('TechnicianGuideDialog', () => {
  it('renderiza la guía paso a paso con los 6 estados y ejemplos reales', () => {
    render(<TechnicianGuideDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('¿Cómo funciona el Panel Técnico?')).toBeInTheDocument()
    expect(screen.getByText('Recibido (Ingreso en Mostrador)')).toBeInTheDocument()
    expect(screen.getByText('En Diagnóstico (Revisión Inicial)')).toBeInTheDocument()
    expect(screen.getByText('En Reparación (Trabajo en Proceso)')).toBeInTheDocument()
    expect(screen.getByText('Pausado / Esperando Piezas')).toBeInTheDocument()
    expect(screen.getByText('Listo para Entrega (Control de Calidad OK)')).toBeInTheDocument()
    expect(screen.getByText('Entregado al Cliente & Garantía')).toBeInTheDocument()

    // Verifica que contiene ejemplos reales
    expect(screen.getAllByText(/Ejemplo real:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Samsung S22 Ultra/i).length).toBeGreaterThan(0)
  })
})

describe('TechnicianListView', () => {
  it('muestra la información clave del técnico: clave de desbloqueo, WhatsApp, urgencia y presupuesto', () => {
    const onView = vi.fn()
    const onEdit = vi.fn()
    const onDeliver = vi.fn()
    const onStatusChange = vi.fn()

    render(
      <TechnicianListView
        repairs={mockRepairs}
        onView={onView}
        onEdit={onEdit}
        onDeliver={onDeliver}
        onStatusChange={onStatusChange}
      />
    )

    // Ticket and device
    expect(screen.getByText('REP-1042')).toBeInTheDocument()
    expect(screen.getByText('Samsung S22 Ultra')).toBeInTheDocument()

    // Pin badge
    expect(screen.getByText('Clave: 1234')).toBeInTheDocument()

    // Customer and phone
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('0981123456')).toBeInTheDocument()

    // Urgency badge
    expect(screen.getByText('Urgente')).toBeInTheDocument()

    // Deliver button available for "listo" repair
    const deliverButtons = screen.getAllByTitle('Marcar como entregado al cliente')
    expect(deliverButtons.length).toBe(1)

    fireEvent.click(deliverButtons[0])
    expect(onDeliver).toHaveBeenCalledWith(mockRepairs[1])
  })

  it('filtra por píldoras de estado', () => {
    render(
      <TechnicianListView
        repairs={mockRepairs}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // Initially both are visible
    expect(screen.getByText('REP-1042')).toBeInTheDocument()
    expect(screen.getByText('REP-1043')).toBeInTheDocument()

    // Click "En Diagnóstico"
    const diagTab = screen.getByRole('button', { name: /En Diagnóstico/i })
    fireEvent.click(diagTab)

    expect(screen.getByText('REP-1042')).toBeInTheDocument()
    expect(screen.queryByText('REP-1043')).not.toBeInTheDocument()
  })

  it('oculta el selector de cambio de estado si el equipo ya fue entregado y ofrece procesar garantía si califica', () => {
    const onClaimWarranty = vi.fn()
    const deliveredRepairWithWarranty: Repair = {
      ...mockRepairs[1],
      id: 'rep-delivered',
      ticketNumber: 'REP-9999',
      status: 'entregado',
      dbStatus: 'entregado',
      warrantyExpiresAt: new Date(Date.now() + 1000 * 3600 * 24 * 30).toISOString(), // 30 days active
      warrantyMonths: 3,
    }

    render(
      <TechnicianListView
        repairs={[deliveredRepairWithWarranty]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onStatusChange={vi.fn()}
        onClaimWarranty={onClaimWarranty}
      />
    )

    // No debe existir el combobox / select de progreso técnico para un equipo entregado
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    // Debe mostrar la insignia de Entregado
    expect(screen.getByText('Entregado')).toBeInTheDocument()

    // Debe mostrar el botón de "Procesar Garantía"
    const warrantyButtons = screen.getAllByRole('button', { name: /Procesar Garantía/i })
    expect(warrantyButtons.length).toBeGreaterThan(0)

    fireEvent.click(warrantyButtons[0])
    expect(onClaimWarranty).toHaveBeenCalledWith(deliveredRepairWithWarranty)
  })

  it('pagina a 20 equipos por página y muestra los controles de paginación', () => {
    // Generate 25 repairs
    const twentyFiveRepairs: Repair[] = Array.from({ length: 25 }, (_, i) => ({
      ...mockRepairs[0],
      id: `rep-${i + 1}`,
      ticketNumber: `REP-TICK-${String(i + 1).padStart(3, '0')}`,
      device: `Dispositivo ${i + 1}`,
    }))

    render(
      <TechnicianListView
        repairs={twentyFiveRepairs}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // First page should show items 1 through 20
    expect(screen.getByText('REP-TICK-001')).toBeInTheDocument()
    expect(screen.getByText('REP-TICK-020')).toBeInTheDocument()
    expect(screen.queryByText('REP-TICK-021')).not.toBeInTheDocument()

    // Both table footer and pagination controls report ranges
    expect(screen.getAllByText(/Mostrando/i).length).toBeGreaterThanOrEqual(2)
  })
})

describe('RepairCardsView', () => {
  it('muestra el botón de Procesar Garantía en tarjetas de equipos entregados con garantía activa', () => {
    const onClaimWarranty = vi.fn()
    const deliveredRepair: Repair = {
      ...mockRepairs[0],
      id: 'rep-delivered-card',
      ticketNumber: 'REP-CARD-777',
      status: 'entregado',
      dbStatus: 'entregado',
      warrantyExpiresAt: new Date(Date.now() + 1000 * 3600 * 24 * 60).toISOString(), // 60 days
      warrantyMonths: 2,
    }

    render(
      <RepairCardsView
        repairs={[deliveredRepair]}
        onView={vi.fn()}
        onClaimWarranty={onClaimWarranty}
      />
    )

    const warrantyButtons = screen.getAllByRole('button', { name: /Procesar Garantía/i })
    expect(warrantyButtons.length).toBeGreaterThan(0)

    fireEvent.click(warrantyButtons[0])
    expect(onClaimWarranty).toHaveBeenCalledWith(deliveredRepair)
  })
})
