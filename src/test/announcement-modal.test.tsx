import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import {
  announcementCtaKind,
  announcementStorageKey,
  isAnnouncementLive,
  normalizeAnnouncement,
  shouldShowAnnouncement,
  type Announcement,
} from '@/lib/announcements/announcement'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const aviso = (extra: Partial<Announcement> = {}): Announcement => ({
  enabled: true,
  title: 'Semana de descuentos',
  message: 'Del 15 al 20 hay ofertas en todas las tiendas.',
  imageUrl: '',
  ctaLabel: '',
  ctaHref: '',
  startsAt: '',
  endsAt: '',
  updatedAt: '2026-09-12T10:00:00.000Z',
  ...extra,
})

const hoy = new Date('2026-09-16T15:00:00')

describe('cuándo se muestra el aviso', () => {
  it('apagado o sin texto no se muestra, aunque esté configurado', () => {
    expect(isAnnouncementLive(aviso({ enabled: false }), hoy)).toBe(false)
    expect(isAnnouncementLive(aviso({ title: '  ' }), hoy)).toBe(false)
    expect(isAnnouncementLive(aviso({ message: '' }), hoy)).toBe(false)
    expect(isAnnouncementLive(null, hoy)).toBe(false)
  })

  it('respeta las fechas de vigencia, incluidos los días de borde', () => {
    expect(isAnnouncementLive(aviso({ startsAt: '2026-09-17' }), hoy)).toBe(false)
    expect(isAnnouncementLive(aviso({ endsAt: '2026-09-15' }), hoy)).toBe(false)
    expect(isAnnouncementLive(aviso({ startsAt: '2026-09-16', endsAt: '2026-09-16' }), hoy)).toBe(true)
    expect(isAnnouncementLive(aviso({ startsAt: '2026-09-10', endsAt: '2026-09-20' }), hoy)).toBe(true)
  })

  it('una vez por día: si ya lo cerró hoy, no vuelve hasta mañana', () => {
    expect(shouldShowAnnouncement(aviso(), hoy, null)).toBe(true)
    expect(shouldShowAnnouncement(aviso(), hoy, '2026-09-16')).toBe(false)
    expect(shouldShowAnnouncement(aviso(), hoy, '2026-09-15')).toBe(true)
  })

  it('si el dueño lo edita, quien ya lo había cerrado vuelve a verlo', () => {
    const antes = announcementStorageKey('marketplace', aviso())
    const despues = announcementStorageKey('marketplace', aviso({ updatedAt: '2026-09-18T09:00:00.000Z' }))
    expect(antes).not.toBe(despues)
    // Cada tienda lleva su propia cuenta.
    expect(announcementStorageKey('tienda:dabasica', aviso())).not.toBe(antes)
  })

  it('el enlace del botón puede ser interno o externo, y nada más', () => {
    expect(announcementCtaKind('/marketplace/productos')).toBe('internal')
    expect(announcementCtaKind('https://instagram.com/tienda')).toBe('external')
    expect(announcementCtaKind('javascript:alert(1)')).toBe('none')
    expect(announcementCtaKind('')).toBe('none')
  })

  it('lo guardado se lee con la forma esperada, venga como venga', () => {
    expect(normalizeAnnouncement({ enabled: 'sí', title: 42 })).toMatchObject({ enabled: false, title: '' })
    expect(normalizeAnnouncement(null)).toMatchObject({ enabled: false, message: '' })
  })
})

describe('el cartel', () => {
  beforeEach(() => {
    vi.setSystemTime(hoy)
    window.localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('aparece con su título y su mensaje', () => {
    render(<AnnouncementModal announcement={aviso()} scope="marketplace" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Semana de descuentos')).toBeInTheDocument()
    expect(screen.getByText(/Del 15 al 20/)).toBeInTheDocument()
  })

  it('al cerrarlo se anota el día y no vuelve a aparecer', () => {
    const { unmount } = render(<AnnouncementModal announcement={aviso()} scope="marketplace" />)
    fireEvent.click(screen.getByRole('button', { name: 'Seguir mirando' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(announcementStorageKey('marketplace', aviso()))).toBe('2026-09-16')
    unmount()

    render(<AnnouncementModal announcement={aviso()} scope="marketplace" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el botón lleva al enlace configurado', () => {
    render(<AnnouncementModal announcement={aviso({ ctaLabel: 'Ver ofertas', ctaHref: '/marketplace/productos' })} scope="marketplace" />)
    expect(screen.getByRole('link', { name: /Ver ofertas/ })).toHaveAttribute('href', '/marketplace/productos')
  })

  it('un enlace que no es una ruta ni una URL no se convierte en botón', () => {
    render(<AnnouncementModal announcement={aviso({ ctaLabel: 'Click', ctaHref: 'javascript:alert(1)' })} scope="marketplace" />)
    expect(screen.queryByRole('link', { name: 'Click' })).not.toBeInTheDocument()
  })

  it('sin aviso configurado no se dibuja nada', () => {
    const { container } = render(<AnnouncementModal announcement={null} scope="marketplace" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('el marketplace y el panel del superadmin', () => {
  it('guardar el aviso lo hace visible enseguida, sin esperar la caché', () => {
    const ruta = leer('src/app/api/superadmin/marketplace-announcement/route.ts')
    expect(ruta).toContain("revalidateTag(PLATFORM_ANNOUNCEMENT_TAG, 'max')")
    expect(ruta).toContain("action: 'update_marketplace_announcement'")
  })

  it('el superadmin lo encuentra en su menú', () => {
    expect(leer('src/components/superadmin/superadmin-shell.tsx')).toContain("href: '/superadmin/web-content/anuncio'")
    expect(leer('src/components/superadmin/WebContentOverview.tsx')).toContain("href: '/superadmin/web-content/anuncio'")
  })
})

describe('el aviso de cada tienda', () => {
  it('se guarda como una opción más del sitio, apagada por defecto', async () => {
    const { getWebsiteSettingsDefaults, applyWebsiteSettingsDefaults } = await import('@/lib/website/default-settings')
    expect(getWebsiteSettingsDefaults().announcement).toMatchObject({ enabled: false, title: '' })

    // Lo guardado sobrevive a la lectura: antes la clave se perdía al fusionar.
    const guardado = applyWebsiteSettingsDefaults({
      announcement: { enabled: true, title: 'Cerramos el sábado', message: 'Atendemos de 8 a 12.' },
    } as never)
    expect(guardado.announcement).toMatchObject({ enabled: true, title: 'Cerramos el sábado' })
  })

  it('la validación acepta lo razonable y frena lo que no se mostraría', async () => {
    const { validateSetting } = await import('@/lib/validation/website-settings')
    expect(validateSetting('announcement', { enabled: true, title: 'Hola', message: 'Texto' }).success).toBe(true)
    expect(validateSetting('announcement', { enabled: false, title: '', message: '' }).success).toBe(true)
    // Activado sin texto, o con un enlace que no es una ruta ni una URL.
    expect(validateSetting('announcement', { enabled: true, title: '', message: '' }).success).toBe(false)
    expect(validateSetting('announcement', { enabled: true, title: 'H', message: 'M', ctaLabel: 'Ir', ctaHref: 'javascript:alert(1)' }).success).toBe(false)
    expect(validateSetting('announcement', { enabled: true, title: 'H', message: 'M', startsAt: '2026-10-05', endsAt: '2026-10-01' }).success).toBe(false)
  })

  it('la tienda lo muestra al entrar, con su propia cuenta por tienda', () => {
    for (const ruta of ['src/app/[organizationSlug]/layout.tsx', 'src/app/(public)/layout.tsx']) {
      const layout = leer(ruta)
      expect(layout).toContain('<AnnouncementModal')
      expect(layout).toContain('normalizeAnnouncement(settings?.announcement)')
      expect(layout).toContain('scope={`tienda:')
    }
  })

  it('el dueño lo encuentra en «Sitio Web»', () => {
    expect(leer('src/components/admin/website/WebsiteNavigation.tsx')).toContain("id: 'announcement'")
    expect(leer('src/app/admin/website/page.tsx')).toContain("tab === 'announcement'")
    expect(leer('src/components/admin/website/WebsiteSectionIntro.tsx')).toContain('Aviso al entrar a tu tienda')
  })
})
