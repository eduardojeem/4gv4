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
  default: ({ children, href, className, style, 'aria-label': ariaLabel }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} className={className} style={style} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

/* eslint-disable @next/next/no-img-element */
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt || ''} src={props.src} />,
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
  it('aplica el color de marca heredado de la tienda cuando no se pasa color', () => {
    render(<EspecialCosmeticosCarousel settings={sampleSettings} />)
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button.className).toContain('from-[var(--cosmetics-500)]')
    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.className).toContain('text-[var(--cosmetics-ink)]')
  })

  it('aplica el color de marca estándar de la organización (ej: purple)', () => {
    const { container } = render(
      <EspecialCosmeticosCarousel settings={sampleSettings} brandColor="purple" />
    )
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button).toBeVisible()
    expect(container.querySelector('section')).toHaveAttribute('data-color-scheme', 'purple')
    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.className).toContain('text-[var(--cosmetics-ink)]')
  })

  it('aplica el color de marca estándar de la organización (ej: emerald)', () => {
    const { container } = render(
      <EspecialCosmeticosCarousel settings={sampleSettings} brandColor="emerald" />
    )
    const button = screen.getByRole('link', { name: /ver colección/i })
    expect(button).toBeVisible()
    expect(container.querySelector('section')).toHaveAttribute('data-color-scheme', 'emerald')
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
    expect(button.style.backgroundColor).toBe('var(--cosmetics-600)')
    expect(container.querySelector('section')?.style.getPropertyValue('--brand-primary')).toBe(customHex)

    const badge = screen.getByText('Exclusivo')
    expect(badge.parentElement?.style.color).toBe('var(--cosmetics-ink)')
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


it('ignora un color personalizado antiguo cuando el comercio elige otra paleta', () => {
  const { container } = render(<EspecialCosmeticosCarousel settings={sampleSettings} brandColor="green" customBrandColor="#B21FB8" />)
  const carousel = container.querySelector('section')
  expect(carousel).toHaveAttribute('data-color-scheme', 'green')
  expect(carousel).not.toHaveAttribute('data-custom-brand')
  expect(carousel?.style.getPropertyValue('--brand-primary')).toBe('')
})
it('no aplica un color personalizado inválido', () => {
  const { container } = render(<EspecialCosmeticosCarousel settings={sampleSettings} brandColor="custom" customBrandColor="invalid" />)
  expect(container.querySelector('section')).not.toHaveAttribute('data-custom-brand')
  expect(screen.getByRole('link', { name: /ver colección/i })).toBeVisible()
})
