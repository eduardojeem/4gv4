import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StoreSetupAlert } from './StoreSetupAlert'
import type { WebsiteSettings } from '@/types/website-settings'

let mockAuth = {
  isAdmin: true,
  isSuperAdmin: false,
}

let mockActiveOrg = {
  organization: {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    storefront_public: false,
  },
}

let mockWebsiteSettings: {
  settings: WebsiteSettings | null
  isLoading: boolean
} = {
  settings: null,
  isLoading: false,
}

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => mockActiveOrg,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => mockWebsiteSettings,
}))

describe('StoreSetupAlert', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockAuth = { isAdmin: true, isSuperAdmin: false }
    mockActiveOrg = {
      organization: {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        storefront_public: false,
      },
    }
  })

  it('renders nothing if user is not admin or superadmin', () => {
    mockAuth = { isAdmin: false, isSuperAdmin: false }
    mockWebsiteSettings = {
      isLoading: false,
      settings: {
        company_info: {
          name: '',
          phone: '',
          address: '',
          storefrontPublic: false,
        },
      } as unknown as WebsiteSettings,
    }

    const { container } = render(<StoreSetupAlert />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while loading', () => {
    mockWebsiteSettings = {
      isLoading: true,
      settings: null,
    }

    const { container } = render(<StoreSetupAlert />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the store is fully configured and published', () => {
    mockActiveOrg.organization.storefront_public = true
    mockWebsiteSettings = {
      isLoading: false,
      settings: {
        company_info: {
          name: 'Tech Store',
          phone: '+595981111222',
          address: 'Avda Central 123',
          storefrontPublic: true,
        },
        checkout: {
          commerceMode: 'whatsapp',
          payment: {
            cash: { enabled: true },
            card: { enabled: false },
            transfer: { enabled: false },
            digital_wallet: { enabled: false },
          },
          delivery: { enabled: true },
          pickup: { enabled: false },
        },
      } as unknown as WebsiteSettings,
    }

    const { container } = render(<StoreSetupAlert />)
    expect(container.firstChild).toBeNull()
  })

  it('renders alert when store is not published', () => {
    mockActiveOrg.organization.storefront_public = false
    mockWebsiteSettings = {
      isLoading: false,
      settings: {
        company_info: {
          name: 'Tech Store',
          phone: '+595981111222',
          address: 'Avda Central 123',
          storefrontPublic: false,
        },
        checkout: {
          commerceMode: 'whatsapp',
        },
      } as unknown as WebsiteSettings,
    }

    render(<StoreSetupAlert />)
    expect(screen.getByText('Tu Tienda Pública aún no está publicada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Terminar de configurar/i })).toHaveAttribute('href', '/admin/website')
    expect(screen.getByRole('link', { name: /Vista previa/i })).toHaveAttribute('href', '/test-org/inicio')
  })

  it('renders alert when company information or checkout is missing', () => {
    mockActiveOrg.organization.storefront_public = true
    mockWebsiteSettings = {
      isLoading: false,
      settings: {
        company_info: {
          name: '', // Missing name
          phone: '',
          address: '',
          storefrontPublic: true,
        },
        checkout: {
          commerceMode: 'cart',
          payment: {
            cash: { enabled: false },
            card: { enabled: false },
            transfer: { enabled: false },
            digital_wallet: { enabled: false },
          },
          delivery: { enabled: false },
          pickup: { enabled: false },
        },
      } as unknown as WebsiteSettings,
    }

    render(<StoreSetupAlert />)
    expect(screen.getByText('Tu Tienda Pública necesita configuración')).toBeInTheDocument()
    expect(screen.getByText('Datos de la empresa')).toBeInTheDocument()
    expect(screen.getByText('Métodos de pago y entrega')).toBeInTheDocument()
  })

  it('dismisses when close button is clicked', () => {
    mockWebsiteSettings = {
      isLoading: false,
      settings: {
        company_info: {
          name: '',
          phone: '',
          address: '',
          storefrontPublic: false,
        },
      } as unknown as WebsiteSettings,
    }

    const { container } = render(<StoreSetupAlert />)
    expect(screen.getByText('Tu Tienda Pública aún no está publicada')).toBeInTheDocument()

    const dismissBtn = screen.getByRole('button', { name: /Ocultar aviso por esta sesión/i })
    fireEvent.click(dismissBtn)

    expect(container.firstChild).toBeNull()
    expect(sessionStorage.getItem('dismissed_store_setup_banner_v1')).toBe('true')
  })
})
