import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StoreTrustBar } from './StoreTrustBar'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'

function renderTrustBar(style: 'beauty' | 'classic', settings?: Parameters<typeof StoreTrustBar>[0]['settings']) {
  return render(
    <StorefrontStyleProvider style={style}>
      <StoreTrustBar settings={settings} />
    </StorefrontStyleProvider>,
  )
}

describe('StoreTrustBar Beauty claims', () => {
  it('does not invent benefits when Beauty has no configured items', () => {
    renderTrustBar('beauty')

    expect(screen.queryByText('Envíos Rápidos')).not.toBeInTheDocument()
    expect(screen.queryByText('Compra Segura')).not.toBeInTheDocument()
    expect(screen.queryByText('Atención Directa')).not.toBeInTheDocument()
  })

  it('shows only explicitly configured Beauty benefits', () => {
    renderTrustBar('beauty', {
      enabled: true,
      position: 'bottom',
      items: [
        { id: 'pickup', icon: 'map-pin', title: 'Retiro coordinado', description: 'Consultá disponibilidad', active: true },
        { id: 'disabled', title: 'Garantía oficial', description: 'No publicar', active: false },
      ],
    })

    expect(screen.getByText('Retiro coordinado')).toBeInTheDocument()
    expect(screen.queryByText('Garantía oficial')).not.toBeInTheDocument()
  })

  it('keeps the existing fallback benefits for other storefronts', () => {
    renderTrustBar('classic')

    expect(screen.getByText('Envíos Rápidos')).toBeInTheDocument()
  })
})
