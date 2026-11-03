import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  accountDataFor,
  accountDisplayName,
  businessFromResponse,
  canOpenBusinessPanel,
} from '../../mobile/src/lib/marketplace-account-model'

const state = vi.hoisted(() => ({ pathname: '/marketplace', user: null as null | { id: string; role: string } }))

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('@/components/public/AuthModal', () => ({ AuthModal: () => null }))

import { MarketplaceMobileBottomNav } from '@/components/public/MarketplaceMobileBottomNav'

const read = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')

describe('web móvil: pestaña Perfil del marketplace', () => {
  beforeEach(() => {
    state.pathname = '/marketplace'
    state.user = { id: 'u1', role: 'cliente' }
  })

  it('el comprador va a su perfil, no al inicio', () => {
    render(<MarketplaceMobileBottomNav />)
    const link = screen.getByRole('link', { name: /perfil/i })
    expect(link).toHaveAttribute('href', '/marketplace/perfil')
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('en el perfil (y sus subpáginas) la pestaña queda activa', () => {
    state.pathname = '/marketplace/perfil/autorizados'
    render(<MarketplaceMobileBottomNav />)
    expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute('aria-current', 'page')
  })

  it('el personal sigue yendo a su panel', () => {
    state.user = { id: 'u2', role: 'admin' }
    render(<MarketplaceMobileBottomNav />)
    expect(screen.getByRole('link', { name: /panel/i })).toHaveAttribute('href', '/dashboard')
  })
})

describe('app: cuenta y negocio del marketplace', () => {
  it('solo un rol de comercio abre el panel; un comprador no', () => {
    const member = (role: string) => businessFromResponse({ ok: true, data: { activeOrganization: { id: 'o1', name: 'Tienda', slug: 'tienda', role } } })
    expect(canOpenBusinessPanel(member('owner'))).toBe(true)
    expect(canOpenBusinessPanel(member('technician'))).toBe(true)
    expect(canOpenBusinessPanel(member('customer'))).toBe(false)
    expect(canOpenBusinessPanel({ state: 'none' })).toBe(false)
  })

  it('un 403 dice que no tiene negocio; otro error no permite afirmarlo', () => {
    expect(businessFromResponse({ ok: false, error: { status: 403 } })).toEqual({ state: 'none' })
    expect(businessFromResponse({ ok: false, error: { status: 500 } })).toEqual({ state: 'unknown' })
    expect(businessFromResponse({ ok: false, error: new Error('Network request failed') })).toEqual({ state: 'unknown' })
  })

  it('al cambiar de cuenta no se muestran los datos de la anterior', () => {
    const loaded = { userId: 'ana', fullName: 'Ana' }
    expect(accountDataFor(loaded, 'ana')).toBe(loaded)
    expect(accountDataFor(loaded, 'beto')).toBeNull()
    expect(accountDataFor(loaded, null)).toBeNull()
  })

  it('el nombre es el del perfil, nunca el prefijo del correo', () => {
    expect(accountDisplayName({ kind: 'buyer', fullName: 'Ana Pérez' })).toBe('Ana Pérez')
    expect(accountDisplayName({ kind: 'buyer', fullName: null })).toBe('Tu cuenta')
    expect(accountDisplayName({ kind: 'guest', fullName: null })).toBe('Invitado')
    expect(read('app/index.tsx')).not.toContain(".split('@')[0]")
  })

  it('pedidos se ven en la app; créditos avisa que abre el sitio; el panel solo con permiso', () => {
    const index = read('app/index.tsx')
    expect(index).not.toContain("openWeb('/marketplace/perfil#pedidos')")
    expect(index).toContain("'/mis-pedidos'")
    expect(index).toContain('Se abre en el sitio web')
    const header = read('components/marketplace-header.tsx')
    expect(header).toContain('panelAllowed && business.state')
    // El menú cierra y después navega, con scroll y altura máxima.
    expect(header).toContain('schedule(action)')
    expect(header).toMatch(/<ScrollView/)
    expect(header).toContain('maxHeight: height - insets.top - insets.bottom')
  })

  it('ni la app ni la web pasan tokens por URL', () => {
    for (const file of ['app/index.tsx', 'components/marketplace-header.tsx', 'app/mis-pedidos.tsx', 'app/mi-cuenta.tsx']) {
      expect(read(file)).not.toMatch(/access_token=|refresh_token=/)
    }
  })
})
