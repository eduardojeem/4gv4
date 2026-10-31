import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TechRepairsBanner } from '../components/public/inicio/TechRepairsBanner'
import { StoreTrustBar } from '../components/public/inicio/StoreTrustBar'
import { PublicFooter } from '../components/public/PublicFooter'
import { StorefrontStyleProvider } from '../components/public/storefront-style-context'
import type { WebsiteSettings } from '../types/website-settings'
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: undefined, isLoading: false }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tienda-local/inicio' }))
describe('followup storefront safety', () => {
 it('keeps repair links scoped to the store without inventing guarantees', () => {
  render(<TechRepairsBanner />)
  expect(screen.getByRole('link', { name: /Rastrear mi reparación/ })).toHaveAttribute('href', '/tienda-local/mis-reparaciones')
  expect(screen.queryByRole('link', { name: /Consultar al negocio/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/garantía escrita|certificados|sin sorpresas/i)).not.toBeInTheDocument()
 })
 it('only renders a contact action with an actual phone number', () => {
  render(<TechRepairsBanner phoneClean="595981000000" />)
  expect(screen.getByRole('link', { name: /Consultar al negocio/ })).toHaveAttribute('href', expect.stringContaining('wa.me/595981000000'))
 })
 it.each(['beauty', 'classic'] as const)('does not invent trust benefits for %s', (style) => {
  const { container } = render(<StorefrontStyleProvider style={style}><StoreTrustBar /></StorefrontStyleProvider>)
  expect(container).toBeEmptyDOMElement()
 })
 it.each(['beauty', 'classic'] as const)('does not promise payment methods or warranty in the %s footer', (style) => {
  render(<StorefrontStyleProvider style={style}><PublicFooter initialSettings={{ company_info: { name: 'Local Test' } } as WebsiteSettings} /></StorefrontStyleProvider>)
  expect(screen.queryByText(/Tienda oficial|garantía|Pagos seguros|SIPAP|Pagos QR/i)).not.toBeInTheDocument()
 })
})
