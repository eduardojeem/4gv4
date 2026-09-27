import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

    expect(screen.getByText('Historial de pagos')).toBeInTheDocument()
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

    expect(screen.getByText('Datos para tus facturas')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Comercial Mi Tienda S.A.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('80012345-6')).toBeInTheDocument()
    window.location.hash = ''
  })
})

describe('las otras tres pestañas', () => {
  const planLibre: PlanRecord = {
    code: 'FREE', slug: 'free', name: 'Plan Free', price_monthly: 0, price_note: 'Siempre gratis',
    currency: 'PYG', limits: { users: 2, branches: 1, cashRegisters: 1, products: 50, categories: null },
    features: { marketplace: false, analytics: false, credits: false }, modules: [], is_active: true,
  }
  const planPro: PlanRecord = {
    code: 'PRO', slug: 'pro', name: 'Plan Pro', price_monthly: 150000, price_note: null,
    currency: 'PYG', limits: { users: 5, branches: 2, cashRegisters: 3, products: 1000, categories: null },
    features: { marketplace: true, analytics: true, credits: true }, modules: [], is_active: true,
  }
  const planMax: PlanRecord = {
    code: 'ENTERPRISE', slug: 'enterprise', name: 'Plan Max', price_monthly: 400000, price_note: null,
    currency: 'PYG', limits: { users: null, branches: null, cashRegisters: null, products: null, categories: null },
    features: { marketplace: true, analytics: true, credits: true }, modules: [], is_active: true,
  }

  const props = {
    currentPlan: planPro,
    usage: { users: 2, branches: 1, cashRegisters: 1, products: 150, categories: 12, repairs: 0, services: 0 },
    plans: [planLibre, planPro, planMax],
    payments: [] as SubscriptionPayment[],
    promoRedemptions: [],
    billingProfile: null,
    subscriptionStatus: 'active',
    canChangePlan: true,
    canRedeemCodes: true,
    averageUsage: 25,
  }

  afterEach(() => { window.location.hash = '' })

  /**
   * Se elegia el plan en la comparativa y la pantalla de cambio lo pedia otra
   * vez, porque el enlace no llevaba nada.
   */
  it('el enlace de cada plan lleva cual elegiste', () => {
    window.location.hash = '#plans'
    render(<SubscriptionsClientView {...props} />)

    const subir = screen.getByRole('link', { name: /Subir a Plan Max/i })
    expect(subir).toHaveAttribute('href', '/admin/subscriptions/change-plan?plan=ENTERPRISE')
  })

  it('dice si vas para arriba o para abajo', () => {
    window.location.hash = '#plans'
    render(<SubscriptionsClientView {...props} />)

    expect(screen.getByRole('link', { name: /Subir a Plan Max/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bajar a Plan Free/i })).toBeInTheDocument()
    // El que ya tenes no se ofrece.
    expect(screen.queryByRole('link', { name: /Plan Pro/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tu plan/i })).toBeDisabled()
  })

  /** Un tilde solo no dice nada en voz alta. */
  it('lo incluido y lo no incluido se pueden leer', () => {
    window.location.hash = '#plans'
    render(<SubscriptionsClientView {...props} />)

    expect(screen.getAllByText('Marketplace web: incluido').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Marketplace web: no incluido').length).toBeGreaterThan(0)
  })

  /** Se veian solo los ultimos 25 y nada lo decia. */
  it('el historial avisa cuando llega al tope', () => {
    window.location.hash = '#payment-history'
    const muchos: SubscriptionPayment[] = Array.from({ length: 25 }, (_, i) => ({
      id: `pay-${i}`,
      subscription_id: 'sub-1',
      plan_id: 'PRO',
      amount: 150000,
      currency: 'PYG',
      status: 'paid',
      payment_method: 'credit_card',
      provider: 'pagopar',
      created_at: '2026-08-01T12:00:00.000Z',
      paid_at: '2026-08-01T12:00:00.000Z',
    }))

    const { unmount } = render(<SubscriptionsClientView {...props} payments={muchos} />)
    expect(screen.getByText(/Se muestran los últimos 25 movimientos/)).toBeInTheDocument()
    unmount()

    render(<SubscriptionsClientView {...props} payments={muchos.slice(0, 3)} />)
    expect(screen.queryByText(/Se muestran los últimos/)).not.toBeInTheDocument()
  })

  /** El ultimo recurso era el plan actual: atribuia un cobro viejo al de hoy. */
  it('un pago sin plan guardado no muestra el plan de hoy', () => {
    window.location.hash = '#payment-history'
    render(
      <SubscriptionsClientView
        {...props}
        payments={[{
          id: 'pay-x',
          subscription_id: 'sub-1',
          plan_id: null,
          amount: 50000,
          currency: 'PYG',
          status: 'paid',
          payment_method: 'transfer',
          provider: 'manual',
          created_at: '2026-01-01T12:00:00.000Z',
          paid_at: '2026-01-01T12:00:00.000Z',
        }]}
      />
    )

    const fila = screen.getByRole('row', { name: /Activación Manual/i })
    expect(fila).toHaveTextContent('—')
    expect(fila).not.toHaveTextContent('Plan Pro')
  })

  /**
   * La confirmacion verde se quedaba mientras volvias a editar: la pantalla
   * decia «guardado» con cambios sin guardar.
   */
  it('la confirmacion se va cuando volves a editar', async () => {
    window.location.hash = '#billing-form'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ billingProfile: {} }) })))

    render(
      <SubscriptionsClientView
        {...props}
        billingProfile={{
          organization_id: 'org-1',
          business_name: 'Mi Empresa S.A.',
          ruc: '80012345-6',
          billing_email: 'facturas@empresa.com',
          fiscal_address: 'Avda. Principal 123',
          phone: '0981123456',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Guardar datos/i }))
    expect(await screen.findByText('Datos guardados.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Razón social/i), { target: { value: 'Otra Empresa S.A.' } })
    expect(screen.queryByText('Datos guardados.')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  /** Con el `required` del navegador estos mensajes no se veian nunca. */
  it('marca el campo que falta en vez de dejarlo al navegador', () => {
    window.location.hash = '#billing-form'
    render(<SubscriptionsClientView {...props} billingProfile={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Guardar datos/i }))

    expect(screen.getByText('Ingresá la razón social.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Razón social/i)).toHaveAttribute('aria-invalid', 'true')
  })
})
