import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionsClientView } from '@/components/admin/subscriptions/SubscriptionsClientView'
import type { PlanRecord, SubscriptionPayment } from '@/lib/saas/subscription-service'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('SubscriptionsClientView component', () => {
  const mockPlan: PlanRecord = {
    code: 'PRO',
    slug: 'pro',
    name: 'Plan Pro',
    price_monthly: 150000,
    price_note: null,
    currency: 'PYG',
    limits: {
      users: 5,
      branches: 2,
      cashRegisters: 3,
      products: 1000,
      categories: null,
    },
    features: {
      marketplace: true,
      analytics: true,
      credits: true,
    },
    modules: ['facturacion', 'inventario'],
    is_active: true,
    is_popular: true,
  }

  const mockPayments: SubscriptionPayment[] = [
    {
      id: 'pay-1',
      subscription_id: 'sub-1',
      amount: 150000,
      currency: 'PYG',
      status: 'paid',
      payment_method: 'credit_card',
      provider: 'pagopar',
      created_at: '2026-08-01T12:00:00.000Z',
      paid_at: '2026-08-01T12:05:00.000Z',
    },
    {
      id: 'pay-2',
      subscription_id: 'sub-1',
      amount: 0,
      currency: 'PYG',
      status: 'paid',
      payment_method: 'activation_code',
      provider: 'activation',
      external_reference: 'VOUCHER-TEST-100',
      created_at: '2026-07-01T12:00:00.000Z',
      paid_at: '2026-07-01T12:00:00.000Z',
    },
  ]

  const defaultProps = {
    currentPlan: mockPlan,
    usage: {
      users: 2,
      branches: 1,
      cashRegisters: 1,
      products: 150,
      categories: 12,
    },
    plans: [mockPlan],
    payments: mockPayments,
    promoRedemptions: [],
    billingProfile: {
      organization_id: 'org-1',
      business_name: 'Comercial Mi Tienda S.A.',
      ruc: '80012345-6',
      billing_email: 'contabilidad@mitienda.com',
      fiscal_address: 'Avda. Principal 123',
      phone: '0981123456',
    },
    subscriptionStatus: 'active',
    canChangePlan: true,
    canRedeemCodes: true,
    averageUsage: 25,
  }

  it('renders all 4 navigation tabs and the quota header', () => {
    render(<SubscriptionsClientView {...defaultProps} />)

    expect(screen.getByRole('tab', { name: /Resumen & Cupos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Planes Disponibles/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Historial de Pagos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Datos Fiscales/i })).toBeInTheDocument()

    // El banner de capacidad repetia el plan y el promedio que ya muestra el
    // encabezado de la pagina; quedo solo lo suyo: como estan los cupos.
    expect(screen.getByText('Cupos de tu plan')).toBeInTheDocument()
    expect(screen.getByText('Todo con margen')).toBeInTheDocument()
    expect(screen.queryByText('Capacidad Operativa de tu Organización')).not.toBeInTheDocument()
  })

  it('renders resource bento cards with correct limits, usage, and available counts', () => {
    render(<SubscriptionsClientView {...defaultProps} />)

    expect(screen.getByText('Usuarios / Staff')).toBeInTheDocument()
    expect(screen.getByText('Sucursales')).toBeInTheDocument()
    expect(screen.getByText('Cajas Registradoras')).toBeInTheDocument()
    expect(screen.getByText('Productos en Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Categorías')).toBeInTheDocument()

    // Usage and available
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('/ 1000 máx.')).toBeInTheDocument()
    expect(screen.getByText('850 lugares')).toBeInTheDocument()
  })

  /**
   * Categorias no tiene tope en ningun plan. La tarjeta pintaba la barra al
   * 100% en verde, que se lee como «lleno», que es lo contrario.
   */
  it('un cupo sin tope no dibuja una barra llena', () => {
    render(<SubscriptionsClientView {...defaultProps} />)

    expect(screen.getByText('Tu plan no pone tope a este recurso')).toBeInTheDocument()
    expect(screen.getByText('Sin tope')).toBeInTheDocument()
    // Las barras son solo las de los cupos con tope: usuarios, sucursales,
    // cajas y productos.
    expect(screen.getAllByRole('progressbar')).toHaveLength(4)
    expect(screen.queryByText('12 lugares')).not.toBeInTheDocument()
  })

  it('avisa cuando un cupo llego al limite', () => {
    render(
      <SubscriptionsClientView
        {...defaultProps}
        usage={{ ...defaultProps.usage, users: 5 }}
        averageUsage={55}
      />
    )

    expect(screen.getByText('Límite alcanzado')).toBeInTheDocument()
    expect(screen.getByText('1 cupo cerca del límite')).toBeInTheDocument()
    expect(screen.queryByText('Todo con margen')).not.toBeInTheDocument()
  })

  /**
   * «Soporte 24/7» estaba escrito a mano: el plan gratuito prometia lo mismo
   * que el mas caro.
   */
  it('el soporte sale del plan, no de un texto fijo', () => {
    const { unmount } = render(<SubscriptionsClientView {...defaultProps} />)
    expect(screen.getByText('Prioritario')).toBeInTheDocument()
    expect(screen.queryByText('24/7')).not.toBeInTheDocument()
    unmount()

    render(
      <SubscriptionsClientView
        {...defaultProps}
        currentPlan={{ ...mockPlan, name: 'Plan Free', price_monthly: 0 }}
      />
    )
    expect(screen.getByText('Comunidad')).toBeInTheDocument()
  })

  it('opens the relocated "¿Cómo funciona?" dialog', () => {
    render(<SubscriptionsClientView {...defaultProps} />)

    const helpBtn = screen.getByRole('button', { name: /¿Cómo funciona?/i })
    fireEvent.click(helpBtn)

    expect(screen.getByText('Centro de Ayuda SaaS')).toBeInTheDocument()
    expect(screen.getByText('Límites & Cupos')).toBeInTheDocument()
    expect(screen.getByText('Pagos & Facturación')).toBeInTheDocument()
    expect(screen.getByText('Cambios de Plan')).toBeInTheDocument()
  })

  it('switches to Historial de Pagos tab via hash and filters payments', () => {
    window.location.hash = '#payment-history'
    render(<SubscriptionsClientView {...defaultProps} />)

    expect(screen.getByText('Historial de Pagos y Facturación')).toBeInTheDocument()
    expect(screen.getByText('Pagopar')).toBeInTheDocument()
    expect(screen.getByText('VOUCHER-TEST-100')).toBeInTheDocument()

    // Click Activaciones filter
    const activacionesBtn = screen.getByRole('button', { name: /Activaciones/i })
    fireEvent.click(activacionesBtn)

    expect(screen.getByText('VOUCHER-TEST-100')).toBeInTheDocument()
    expect(screen.queryByText('Pagopar')).not.toBeInTheDocument()
    window.location.hash = ''
  })

  /** Las modalidades se contaban todas, pero solo cuatro tenian boton. */
  it('ofrece filtrar tambien las cortesias', () => {
    window.location.hash = '#payment-history'
    render(
      <SubscriptionsClientView
        {...defaultProps}
        payments={[
          ...mockPayments,
          {
            id: 'pay-3',
            subscription_id: 'sub-1',
            amount: 0,
            currency: 'PYG',
            status: 'paid',
            payment_method: 'trial',
            provider: 'trial',
            created_at: '2026-06-01T12:00:00.000Z',
            paid_at: '2026-06-01T12:00:00.000Z',
          },
        ]}
      />
    )

    const cortesia = screen.getByRole('button', { name: /Cortesía \(1\)/i })
    fireEvent.click(cortesia)

    expect(screen.queryByText('VOUCHER-TEST-100')).not.toBeInTheDocument()
    expect(screen.getByText('Prueba / Cortesía')).toBeInTheDocument()
    window.location.hash = ''
  })

  it('switches to Datos Fiscales tab via hash and displays the billing profile', () => {
    window.location.hash = '#billing-form'
    render(<SubscriptionsClientView {...defaultProps} />)

    expect(screen.getByText('Perfil de Facturación Fiscal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Comercial Mi Tienda S.A.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('80012345-6')).toBeInTheDocument()
    window.location.hash = ''
  })
})
