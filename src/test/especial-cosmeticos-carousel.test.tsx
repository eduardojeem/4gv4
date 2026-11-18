import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EspecialCosmeticosCarousel } from '@/components/public/especial-cosmeticos/EspecialCosmeticosCarousel'
import type { PromotionalCarouselSettings } from '@/types/website-settings'

vi.mock('next/navigation', () => ({
  usePathname: () => '/paravos/inicio',
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className, style, 'aria-label': ariaLabel }: any) => (
    <a href={href} className={className} style={style} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

/* eslint-disable @next/next/no-img-element */
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ''} src={props.src} />,
}))

const sampleSettings: PromotionalCarouselSettings = {
  enabled: true,
  intervalSeconds: 5,
  autoplay: true,
  layoutMode: 'contained',
  slides: [
    {
      id: 'slide-1',
      title: 'Serum Hidratante Glow',
      message: 'Revitaliza tu piel con ácido hialurónico puro.',
      imageUrl: 'https://images.unsplash.com/photo-sample.jpg',
      ctaText: 'Ver Colección',
      ctaHref: '/productos/serum',
      badge: 'Exclusivo',
      active: true,
      order: 0,
      contentAlign: 'left',
      titleSize: 'normal',
      fontFamily: 'serif',
      overlayIntensity: 'medium',
    },
  ],
}

describe('EspecialCosmeticosCarousel — colores y formatos', () => {
  it('aplica el color de marca predeterminado (rose) cuando no se pasa color', () => {
    const { container } = render(<EspecialCosmeticosCarousel settings={sampleSettings} />)
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button.className).toContain('from-rose-500')
    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.className).toContain('text-rose-700')
  })

  it('aplica el color de marca estándar de la organización (ej: purple)', () => {
    const { container } = render(
      <EspecialCosmeticosCarousel settings={sampleSettings} brandColor="purple" />
    )
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button.className).toContain('from-purple-600')
    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.className).toContain('text-purple-700')
  })

  it('aplica el color de marca estándar de la organización (ej: emerald)', () => {
    const { container } = render(
      <EspecialCosmeticosCarousel settings={sampleSettings} brandColor="emerald" />
    )
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button.className).toContain('from-emerald-600')
  })

  it('aplica color personalizado hexadecimal (ej: Bordó #8B1E3F o Fucsia #B21FB8) a botón, badge y borde', () => {
    const customHex = '#8B1E3F'
    const { container } = render(
      <EspecialCosmeticosCarousel
        settings={sampleSettings}
        brandColor="custom"
        customBrandColor={customHex}
      />
    )
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button.style.backgroundColor).toBe('rgb(139, 30, 63)') // #8B1E3F in RGB

    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.style.color).toBe('rgb(139, 30, 63)')
  })

  it('respeta ancho full-bleed cuando layoutMode es full', () => {
    const fullBleedSettings: PromotionalCarouselSettings = {
      ...sampleSettings,
      layoutMode: 'full',
    }
    const { container } = render(<EspecialCosmeticosCarousel settings={fullBleedSettings} />)
    const frame = container.querySelector('.rounded-none')
    expect(frame).toBeTruthy()
  })

  it('respeta ancho compacto cuando layoutMode es compact', () => {
    const compactSettings: PromotionalCarouselSettings = {
      ...sampleSettings,
      layoutMode: 'compact',
    }
    const { container } = render(<EspecialCosmeticosCarousel settings={compactSettings} />)
    const frame = container.querySelector('.rounded-2xl')
    expect(frame).toBeTruthy()
  })
})
