import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EspecialCosmeticosHeader } from '@/components/public/especial-cosmeticos/EspecialCosmeticosHeader'
import type { WebsiteSettings } from '@/types/website-settings'

vi.mock('next/navigation', () => ({
  usePathname: () => '/paravos/inicio',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

vi.mock('@/hooks/use-hydrated', () => ({
  useHydrated: () => true,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: null, isLoading: false, error: null }),
}))

vi.mock('@/hooks/use-public-cart', () => ({
  usePublicCart: () => ({ count: 0 }),
}))

vi.mock('@/contexts/cart-drawer-context', () => ({
  useCartDrawer: () => ({ open: vi.fn() }),
}))

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className, style }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  ),
}))

/* eslint-disable @next/next/no-img-element */
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt || ''} src={props.src} />,
}))

function createSettings(headerStyle?: 'solid' | 'accent' | 'dark', customBrandColor?: string): WebsiteSettings {
  return {
    company_info: {
      name: 'Glow Skincare',
      slogan: 'Cosmética Natural',
      phone: '0981123456',
      email: 'info@glow.com',
      address: 'Asunción, Paraguay',
      hours: { weekdays: '08:00 a 19:00', saturday: '', sunday: '' },
      headerStyle: headerStyle ?? 'solid',
      brandColor: customBrandColor ? 'custom' : 'rose',
      customBrandColor,
      showTopBar: true,
    },
  } as unknown as WebsiteSettings
}

describe('EspecialCosmeticosHeader — headerStyle («Claro», «Color de marca», «Oscuro»)', () => {
  it('aplica diseño Claro (solid) con fondo boutique #FFFDFB por defecto', () => {
    const settings = createSettings('solid')
    const { container } = render(<EspecialCosmeticosHeader settings={settings} />)
    const header = container.querySelector('header')
    expect(header?.className).toContain('bg-[var(--cosmetics-page)]')
    expect(header?.className).not.toContain('bg-[var(--cosmetics-600)]')
    expect(header?.className).not.toContain('bg-stone-950')
  })

  it('aplica diseño Oscuro (dark) con fondo stone-950 y texto blanco cuando se elige «Oscuro»', () => {
    const settings = createSettings('dark')
    const { container } = render(<EspecialCosmeticosHeader settings={settings} />)
    const header = container.querySelector('header')
    expect(header?.className).toContain('bg-stone-950')
    expect(header?.className).toContain('dark:bg-[var(--cosmetics-page)]')
    expect(header?.className).toContain('text-white')
    expect(header?.className.split(' ')).not.toContain('bg-[var(--cosmetics-page)]')
  })

  it('aplica diseño Color de marca (accent) con bg-[var(--cosmetics-600)] y texto blanco cuando se elige «Color de marca»', () => {
    const settings = createSettings('accent')
    const { container } = render(<EspecialCosmeticosHeader settings={settings} />)
    const header = container.querySelector('header')
    expect(header?.className).toContain('bg-[var(--cosmetics-600)]')
    expect(header?.className).toContain('text-white')
    expect(header?.className).not.toContain('bg-[var(--cosmetics-page)]')
  })

  it('aplica tono accesible derivado del color personalizado (ej: Bordó #8B1E3F) cuando headerStyle es accent y customBrandColor está definido', () => {
    const settings = createSettings('accent', '#8B1E3F')
    const { container } = render(<EspecialCosmeticosHeader settings={settings} />)
    const header = container.querySelector('header')
    expect(header?.style.backgroundColor).toBe('var(--cosmetics-600)')
  })

  it('incluye opción de volver al marketplace en el encabezado', () => {
    const settings = createSettings('solid')
    render(<EspecialCosmeticosHeader settings={settings} />)
    const marketplaceLinks = screen.getAllByRole('link', { name: /marketplace/i })
    expect(marketplaceLinks.length).toBeGreaterThanOrEqual(1)
    expect(marketplaceLinks.every((link) => link.getAttribute('href') === '/marketplace')).toBe(true)
  })
})
