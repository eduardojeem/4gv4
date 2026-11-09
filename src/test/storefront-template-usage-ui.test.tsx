import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StorefrontTemplatePlansManager } from '@/components/superadmin/StorefrontTemplatePlansManager'
import { summarizeTemplateUsage } from '@/lib/website/template-usage'
vi.mock('@/components/admin/website/StorefrontTemplateThumbnail', () => ({ StorefrontTemplateThumbnail: () => null }))
afterEach(() => vi.unstubAllGlobals())
describe('template usage column', () => {
 it('displays saved selections beside the matching template', async () => {
  const usage = summarizeTemplateUsage(['a'], [{ organization_id: 'a', value: { storefrontStyle: 'tech' } }])
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/usage') ? { usage } : { plans: [{ code: 'BASIC', name: 'Basic', templates: ['classic'], isActive: true }] } })))
  render(<StorefrontTemplatePlansManager />)
  expect(await screen.findByRole('columnheader', { name: 'Empresas' })).toBeInTheDocument()
  expect(await screen.findByLabelText(/1 empresas/)).toBeInTheDocument()
  expect(screen.getByText(/1 empresas en total/)).toBeInTheDocument()
 })
 it('does not show zero when the usage query fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !url.endsWith('/usage'), json: async () => ({ plans: [] }) })))
  render(<StorefrontTemplatePlansManager />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el uso')
 })
})
