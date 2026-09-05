import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from '@/app/login/page'

let mockSearchParams = new URLSearchParams()

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  }),
}))

// Mock branding hook
vi.mock('@/hooks/use-platform-branding', () => ({
  usePlatformBranding: () => ({
    branding: {
      platformName: '4G Soluciones',
      marketplaceName: '4G Marketplace',
      marketplaceTagline: 'Tu tienda de confianza',
      loginEyebrow: 'Acceso Empresa',
      loginSubtitle: 'Ingresá al panel administrativo de tu empresa.',
      logoUrl: '/logo.png',
      logoDarkUrl: '/logo.png',
    },
  }),
}))

// Mock Turnstile
vi.mock('@/components/security/TurnstileChallenge', () => ({
  TurnstileChallenge: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" data-testid="turnstile-mock" onClick={() => onTokenChange('mock-token')}>
      Verify Captcha
    </button>
  ),
}))

// Mock SaaSPublicNav
vi.mock('@/components/public/saas-public-nav', () => ({
  SaaSPublicNav: () => <nav data-testid="saas-nav">SaaS Nav</nav>,
}))

describe('LoginPage Redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('renders modern login page with headlines and feature cards in SaaS context', () => {
    render(<LoginPage />)

    // Check main headings and brand presence
    expect(screen.getByText(/Control total de tu taller/i)).toBeInTheDocument()
    expect(screen.getByText(/Gestión de Reparaciones/i)).toBeInTheDocument()
    expect(screen.getByText(/Inventario y POS Rápido/i)).toBeInTheDocument()
    expect(screen.getByText(/Métricas y Rentabilidad/i)).toBeInTheDocument()
    expect(screen.getByText(/Tienda Online & Catálogo/i)).toBeInTheDocument()

    // Check inputs
    expect(screen.getByPlaceholderText('nombre@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()

    // Check action buttons
    expect(screen.getByRole('button', { name: /Iniciar sesión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i })).toBeInTheDocument()
    expect(screen.getByText(/Registrar mi empresa/i)).toBeInTheDocument()
  })



  it('renders customer/marketplace view when arriving from marketplace', () => {
    mockSearchParams = new URLSearchParams('redirect=/marketplace')
    render(<LoginPage />)

    expect(screen.getByText(/Portal de Compras y Seguimiento/i)).toBeInTheDocument()
    expect(screen.getByText(/Seguimiento de Taller/i)).toBeInTheDocument()
    expect(screen.getByText(/Compras & Favoritos/i)).toBeInTheDocument()
    expect(screen.getByText(/Crear cuenta de cliente gratis/i)).toBeInTheDocument()
    expect(screen.getByText(/Volver a la tienda/i)).toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    render(<LoginPage />)
    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleButton = screen.getByLabelText('Mostrar contraseña')
    fireEvent.click(toggleButton)
    expect(passwordInput.type).toBe('text')

    const hideButton = screen.getByLabelText('Ocultar contraseña')
    fireEvent.click(hideButton)
    expect(passwordInput.type).toBe('password')
  })

  it('opens password reset dialog when clicking forgot password', () => {
    render(<LoginPage />)
    const forgotBtn = screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i })
    fireEvent.click(forgotBtn)

    expect(screen.getByRole('heading', { name: 'Restablecer contraseña' })).toBeInTheDocument()
    expect(screen.getByText(/Ingresá el correo asociado a tu cuenta/i)).toBeInTheDocument()
  })
})
