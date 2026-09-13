import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import {
  MAX_PLATFORM_ANNOUNCEMENTS,
  MAX_STORE_ANNOUNCEMENTS,
  announcementCtaKind,
  announcementImages,
  announcementStatus,
  announcementStorageKey,
  isAnnouncementLive,
  normalizeAnnouncement,
  normalizeAnnouncementList,
  pickLiveAnnouncement,
  shouldShowAnnouncement,
  type Announcement,
} from '@/lib/announcements/announcement'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const aviso = (extra: Partial<Announcement> = {}): Announcement => ({
  id: 'aviso-1',
  enabled: true,
  title: 'Semana de descuentos',
  message: 'Del 15 al 20 hay ofertas en todas las tiendas.',
  imageUrl: '',
  images: [],
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
      // De la lista se muestra el primero vigente.
      expect(layout).toContain('pickLiveAnnouncement(')
      expect(layout).toContain('normalizeAnnouncementList(settings?.announcements ?? settings?.announcement, MAX_STORE_ANNOUNCEMENTS)')
      expect(layout).toContain('scope={`tienda:')
    }
  })

  it('el dueño lo encuentra en «Sitio Web»', () => {
    expect(leer('src/components/admin/website/WebsiteNavigation.tsx')).toContain("id: 'announcement'")
    expect(leer('src/app/admin/website/page.tsx')).toContain("tab === 'announcement'")
    expect(leer('src/components/admin/website/WebsiteSectionIntro.tsx')).toContain('Aviso al entrar a tu tienda')
  })
})

describe('las imágenes del cartel', () => {
  beforeEach(() => {
    vi.setSystemTime(hoy)
    window.localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  const conImagenes = aviso({
    images: [
      { url: '/banners/uno.jpg', alt: 'Descuentos de octubre', href: '/marketplace/ofertas' },
      { url: '/banners/dos.jpg', alt: 'Envíos gratis', href: '' },
    ],
  })

  it('un aviso viejo con una sola imagen se sigue viendo', () => {
    expect(announcementImages(aviso({ imageUrl: '/banners/viejo.jpg' }))).toEqual([
      { url: '/banners/viejo.jpg', alt: '', href: '' },
    ])
    expect(announcementImages(aviso())).toEqual([])
    // La lista nueva gana sobre la vieja.
    expect(announcementImages(aviso({ imageUrl: '/viejo.jpg', images: [{ url: '/nuevo.jpg', alt: '', href: '' }] })))
      .toEqual([{ url: '/nuevo.jpg', alt: '', href: '' }])
  })

  it('se guardan hasta cinco y se descartan las que no tienen dirección', () => {
    const guardado = normalizeAnnouncement({
      images: [
        { url: ' /a.jpg ', alt: ' Uno ' },
        { alt: 'sin dirección' },
        ...Array.from({ length: 6 }, (_, i) => ({ url: `/b${i}.jpg` })),
      ],
    })
    expect(guardado.images).toHaveLength(5)
    expect(guardado.images[0]).toEqual({ url: '/a.jpg', alt: 'Uno', href: '' })
  })

  it('muestra la primera y deja elegir las otras', () => {
    render(<AnnouncementModal announcement={conImagenes} scope="marketplace" />)
    expect(screen.getByAltText('Descuentos de octubre')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 2 de 2' }))
    expect(screen.getByAltText('Envíos gratis')).toBeInTheDocument()
    expect(screen.queryByAltText('Descuentos de octubre')).not.toBeInTheDocument()
  })

  it('una imagen con enlace propio lleva a su destino', () => {
    render(<AnnouncementModal announcement={conImagenes} scope="marketplace" />)
    expect(screen.getByRole('link', { name: 'Descuentos de octubre' })).toHaveAttribute('href', '/marketplace/ofertas')
  })

  it('con una sola imagen no hay puntitos que elegir', () => {
    render(<AnnouncementModal announcement={aviso({ images: [{ url: '/uno.jpg', alt: 'Sola', href: '' }] })} scope="marketplace" />)
    expect(screen.getByAltText('Sola')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver imagen/ })).not.toBeInTheDocument()
  })

  it('la tienda las valida igual, con el mismo tope', async () => {
    const { validateSetting } = await import('@/lib/validation/website-settings')
    const base = { enabled: true, title: 'Hola', message: 'Texto' }
    expect(validateSetting('announcement', { ...base, images: [{ url: '/a.jpg' }] }).success).toBe(true)
    expect(validateSetting('announcement', {
      ...base,
      images: Array.from({ length: 6 }, (_, i) => ({ url: `/b${i}.jpg` })),
    }).success).toBe(false)
  })

  it('los dos editores suben el archivo a donde corresponde', () => {
    const superadmin = leer('src/components/superadmin/MarketplaceAnnouncementsForm.tsx')
    expect(superadmin).toContain("/api/superadmin/platform-branding/logo")
    expect(superadmin).toContain("body.append('assetType', 'announcement')")

    const tienda = leer('src/components/admin/website/AnnouncementEditor.tsx')
    // Queda bajo la carpeta de esa organización, como los banners.
    expect(tienda).toContain("/api/admin/website/promotion-image")

    // El campo de imágenes es el mismo para los dos.
    expect(leer('src/components/announcements/AnnouncementsManager.tsx')).toContain('<AnnouncementImagesField')
  })
})

describe('varios avisos cargados', () => {
  const base = (extra: Partial<Announcement> = {}): Announcement => aviso({ id: 'a1', ...extra })

  it('la lista acepta un aviso viejo suelto y le pone un identificador', () => {
    const lista = normalizeAnnouncementList({ title: 'Viejo', message: 'Texto' }, 3)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ id: 'aviso-1', title: 'Viejo' })
  })

  it('descarta los vacíos y recorta al tope de cada lado', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ({ title: `Aviso ${i}`, message: 'Texto' }))
    expect(normalizeAnnouncementList([...muchos, { title: '', message: '' }], MAX_STORE_ANNOUNCEMENTS)).toHaveLength(3)
    expect(normalizeAnnouncementList(muchos, MAX_PLATFORM_ANNOUNCEMENTS)).toHaveLength(8)
    expect(MAX_STORE_ANNOUNCEMENTS).toBe(3)
    expect(MAX_PLATFORM_ANNOUNCEMENTS).toBe(50)
  })

  it('se muestra el primero vigente de la lista', () => {
    const vencido = base({ id: 'v', title: 'Vencido', endsAt: '2026-09-15' })
    const vigente = base({ id: 'b', title: 'Vigente' })
    const otro = base({ id: 'c', title: 'Otro' })

    expect(pickLiveAnnouncement([vencido, vigente, otro], hoy)?.id).toBe('b')
    expect(pickLiveAnnouncement([vencido], hoy)).toBeNull()
    expect(pickLiveAnnouncement([], hoy)).toBeNull()
  })

  it('cada aviso dice en qué está', () => {
    expect(announcementStatus(base({ enabled: false }), hoy)).toBe('apagado')
    expect(announcementStatus(base({ message: '' }), hoy)).toBe('incompleto')
    expect(announcementStatus(base({ startsAt: '2026-09-20' }), hoy)).toBe('programado')
    expect(announcementStatus(base({ endsAt: '2026-09-10' }), hoy)).toBe('vencido')
    expect(announcementStatus(base(), hoy)).toBe('activo')
  })

  it('la marca de «ya lo vi» es por aviso: editar uno no hace reaparecer los otros', () => {
    const uno = base({ id: 'a1', updatedAt: 'v1' })
    const dos = base({ id: 'a2', updatedAt: 'v1' })
    expect(announcementStorageKey('marketplace', uno)).not.toBe(announcementStorageKey('marketplace', dos))
    expect(announcementStorageKey('marketplace', { ...uno, updatedAt: 'v2' })).not.toBe(
      announcementStorageKey('marketplace', uno),
    )
  })

  it('los dos editores usan la misma lista, con su propio tope', () => {
    const tienda = leer('src/components/admin/website/AnnouncementEditor.tsx')
    expect(tienda).toContain('<AnnouncementsManager')
    expect(tienda).toContain('max={MAX_STORE_ANNOUNCEMENTS}')

    const superadmin = leer('src/components/superadmin/MarketplaceAnnouncementsForm.tsx')
    expect(superadmin).toContain('<AnnouncementsManager')
    expect(superadmin).toContain('max={MAX_PLATFORM_ANNOUNCEMENTS}')
  })

  it('la tienda guarda la lista validada, con su tope', async () => {
    const { validateSetting } = await import('@/lib/validation/website-settings')
    const item = { enabled: true, title: 'Hola', message: 'Texto' }
    expect(validateSetting('announcements', [item, item]).success).toBe(true)
    expect(validateSetting('announcements', [item, item, item, item]).success).toBe(false)
  })
})
