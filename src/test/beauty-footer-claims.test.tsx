import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'
import { PublicFooter } from '@/components/public/PublicFooter'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'

vi.mock('swr', () => ({ default: () => ({ data: undefined, error: undefined, isLoading: false }) }))

const initialSettings = {
  company_info: { name: 'Tienda de prueba' },
} as unknown as WebsiteSettings

function renderFooter(style: 'beauty' | 'classic') {
  return render(
    <StorefrontStyleProvider style={style}>
      <PublicFooter initialSettings={initialSettings} />
    </StorefrontStyleProvider>,
  )
}

describe('Beauty footer claims', () => {
  it('does not add shipping, warranty, or personalized-attention promises without a configured slogan', () => {
    renderFooter('beauty')

    expect(screen.queryByText(/garantía|envíos|atención personalizada/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tienda oficial\. Catálogo con stock actualizado/i)).not.toBeInTheDocument()
  })

  it('keeps the existing footer copy for other storefronts', () => {
    renderFooter('classic')

    expect(screen.getByText(/Tienda oficial\. Catálogo con stock actualizado, garantía y atención personalizada/i)).toBeInTheDocument()
  })
})
