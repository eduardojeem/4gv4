import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import type { PromotionalCarouselSettings } from '@/types/website-settings'

vi.mock('next/image', () => ({
  default: ({ fill, priority, alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill
    void priority
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...props} />
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/4g-celulares/inicio',
}))

const settings: PromotionalCarouselSettings = {
  enabled: true,
  autoplay: false,
  intervalSeconds: 6,
  slides: [
    {
      id: 'slide-1',
      title: 'Accesorios en oferta',
      message: 'Promociones por tiempo limitado.',
      imageUrl: 'https://example.com/promotion-1.webp',
      imageAlt: 'Accesorios incluidos en la promocion',
      ctaText: 'Ver productos',
      ctaHref: '/productos',
      active: true,
      textTone: 'light',
      contentAlign: 'left',
    },
    {
      id: 'slide-hidden',
      title: 'Promocion oculta',
      message: 'Este contenido no debe publicarse.',
      imageUrl: 'https://example.com/hidden.webp',
      imageAlt: 'Promocion que esta oculta',
      active: false,
      textTone: 'dark',
      contentAlign: 'center',
    },
    {
      id: 'slide-2',
      title: 'Renova tu equipo',
      message: 'Consulta las opciones disponibles.',
      imageUrl: 'https://example.com/promotion-2.webp',
      imageAlt: 'Telefonos disponibles para renovar',
      active: true,
      textTone: 'dark',
      contentAlign: 'right',
    },
  ],
}

describe('PromotionalCarousel', () => {
  it('renders only active slides and prefixes internal tenant links', () => {
    render(<PromotionalCarousel settings={settings} />)

    expect(screen.getByRole('region', { name: 'Promoción 1 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accesorios en oferta' })).toBeInTheDocument()
    expect(screen.queryByText('Promocion oculta')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver productos' })).toHaveAttribute('href', '/4g-celulares/productos')
  })

  it('allows direct navigation and exposes playback controls', () => {
    render(<PromotionalCarousel settings={settings} />)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente promoción' }))

    expect(screen.getByRole('heading', { name: 'Renova tu equipo' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Promoción 2 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pausar carrusel' })).toBeInTheDocument()
  })

  it('supports swipe navigation on touch screens', () => {
    render(<PromotionalCarousel settings={settings} />)
    const carousel = screen.getByRole('region', { name: 'Promoción 1 de 2' })

    fireEvent.touchStart(carousel, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] })

    expect(screen.getByRole('heading', { name: 'Renova tu equipo' })).toBeInTheDocument()
  })

  it('does not render when the section is disabled', () => {
    const { container } = render(<PromotionalCarousel settings={{ ...settings, enabled: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('uses its promotion title as the visible page heading when it leads the home', () => {
    render(<PromotionalCarousel settings={settings} isPageLead />)
    expect(screen.getByRole('heading', { level: 1, name: 'Accesorios en oferta' })).toBeInTheDocument()
  })

  it('renders a graphic banner without text as a full clickable link', () => {
    const bannerSettings: PromotionalCarouselSettings = {
      enabled: true,
      autoplay: false,
      intervalSeconds: 6,
      slides: [
        {
          id: 'slide-graphic',
          title: '',
          message: '',
          imageUrl: 'https://example.com/banner-limpio.webp',
          imageAlt: 'Gran liquidación de invierno',
          ctaHref: '/productos?oferta=true',
          active: true,
          textTone: 'light',
          contentAlign: 'center',
          hideText: true,
          overlayIntensity: 'none',
        },
      ],
    }

    render(<PromotionalCarousel settings={bannerSettings} />)

    // El banner entero es un link con el texto alternativo accesible
    const link = screen.getByRole('link', { name: 'Gran liquidación de invierno' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/4g-celulares/productos?oferta=true')
    // No debe haber encabezado visible superpuesto
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders badge pill and custom title size on slides', () => {
    const badgeSettings: PromotionalCarouselSettings = {
      enabled: true,
      autoplay: false,
      intervalSeconds: 6,
      slides: [
        {
          id: 'slide-badge',
          title: 'Mega Liquidación',
          message: 'Todo con hasta 50% de descuento.',
          imageUrl: 'https://example.com/banner.webp',
          imageAlt: 'Mega Liquidación',
          ctaText: 'Ver productos',
          ctaHref: '/productos',
          active: true,
          textTone: 'light',
          contentAlign: 'left',
          badge: '🔥 50% OFF',
          titleSize: 'large',
        },
      ],
    }

    render(<PromotionalCarousel settings={badgeSettings} />)

    expect(screen.getByText('🔥 50% OFF')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mega Liquidación' })).toBeInTheDocument()
  })

  it('renders custom titleColor and fontFamily on slides', () => {
    const styledSettings: PromotionalCarouselSettings = {
      enabled: true,
      autoplay: false,
      intervalSeconds: 6,
      slides: [
        {
          id: 'slide-styled',
          title: 'Temporada de Oro',
          message: 'Colección exclusiva para ocasiones especiales.',
          imageUrl: 'https://example.com/oro.webp',
          imageAlt: 'Temporada de Oro',
          ctaText: 'Ver colección',
          ctaHref: '/productos',
          active: true,
          textTone: 'light',
          contentAlign: 'left',
          titleColor: '#facc15',
          fontFamily: 'serif',
        },
      ],
    }

    render(<PromotionalCarousel settings={styledSettings} />)

    const heading = screen.getByRole('heading', { name: 'Temporada de Oro' })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveStyle({ color: 'rgb(250, 204, 21)' }) // #facc15 in rgb
    expect(heading).toHaveClass('font-serif')
  })
})
