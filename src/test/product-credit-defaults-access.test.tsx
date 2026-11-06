/**
 * Acceso a la configuración de datos predeterminados desde /dashboard/products.
 *
 * Verifica que la página nueva se monte sin errores y que el acceso directo
 * apunte a la ruta correcta.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ role: 'owner' }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ loading: false, user: { id: 'owner', role: 'admin', organization: { id: 'org', role: access.role } } }) }))
beforeEach(() => { access.role = 'owner' })

vi.mock('@/components/auth/permission-guard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: null,
    isLoading: true,
    error: null,
    isSaving: false,
    updateSetting: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))

import ProductCreditDefaultsPage from '@/app/dashboard/products/credit-defaults/page'

const workspace = process.cwd()
const productsPage = readFileSync(
  resolve(workspace, 'src/app/dashboard/products/page.tsx'),
  'utf8'
)

describe('/dashboard/products/credit-defaults', () => {
  it('no ofrece el editor a personal sin administración del comercio activo', () => {
    access.role = 'vendedor'
    render(<ProductCreditDefaultsPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Solo el dueño o un administrador')
    expect(screen.queryByText('Cargando configuración...')).not.toBeInTheDocument()
  })
  it('monta la página sin errores', () => {
    expect(() => render(<ProductCreditDefaultsPage />)).not.toThrow()
  })

  it('explica de qué se trata y cómo volver', () => {
    render(<ProductCreditDefaultsPage />)

    expect(screen.getByRole('heading', { name: /Datos predeterminados de cuotas/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver a Productos/i }))
      .toHaveAttribute('href', '/dashboard/products')
  })

  it('protege la ruta con el mismo permiso que Productos', () => {
    const pageSource = readFileSync(
      resolve(workspace, 'src/app/dashboard/products/credit-defaults/page.tsx'),
      'utf8'
    )

    expect(pageSource).toContain('<RouteGuard route="/dashboard/products">')
  })
})

describe('acceso directo desde /dashboard/products', () => {
  // Renderizar la pagina de productos entera exigiria mockear medio dashboard,
  // asi que se verifica sobre el fuente. Alcanza para detectar que alguien
  // borre el acceso o le cambie el destino, que es el riesgo real.
  it('enlaza a la página de datos predeterminados', () => {
    expect(productsPage).toContain('href="/dashboard/products/credit-defaults"')
  })

  it('el acceso vive en la barra de acciones, junto a la guía', () => {
    const shortcutIndex = productsPage.indexOf('/dashboard/products/credit-defaults')
    const guideIndex = productsPage.indexOf('<SectionGuideButton guide={PRODUCTS_GUIDE} />')

    expect(shortcutIndex).toBeGreaterThan(-1)
    expect(guideIndex).toBeGreaterThan(-1)
    expect(shortcutIndex).toBeLessThan(guideIndex)
  })
})
