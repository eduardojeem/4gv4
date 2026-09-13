/**
 * Aviso emergente: el cartel que aparece al entrar al marketplace o a una
 * tienda para anunciar una campaña, un horario especial o una novedad.
 *
 * La misma forma sirve para los dos: el del marketplace lo edita el superadmin
 * y el de cada tienda su dueño. Las reglas de cuando mostrarlo viven aca, sin
 * React ni navegador, para poder probarlas.
 */

export type AnnouncementImage = {
  url: string
  /** Texto alternativo: lo lee quien no ve la imagen. */
  alt: string
  /** Enlace propio de esa imagen, opcional. */
  href: string
}

/** Mas de esto no entra en un cartel sin volverse una galeria. */
export const MAX_ANNOUNCEMENT_IMAGES = 5

/** Cuantos avisos puede tener cargados cada quien. */
export const MAX_STORE_ANNOUNCEMENTS = 3
export const MAX_PLATFORM_ANNOUNCEMENTS = 50

export type Announcement = {
  /** Identifica al aviso dentro de la lista, para editarlo o borrarlo. */
  id: string
  enabled: boolean
  title: string
  message: string
  /** Compatibilidad: los avisos viejos tenian una sola imagen. */
  imageUrl: string
  images: AnnouncementImage[]
  ctaLabel: string
  ctaHref: string
  /** Vigencia opcional, en formato AAAA-MM-DD. Vacio: sin limite. */
  startsAt: string
  endsAt: string
  /** Cambia cuando se edita el aviso: quien ya lo habia cerrado vuelve a verlo. */
  updatedAt: string
}

export const EMPTY_ANNOUNCEMENT: Announcement = {
  id: '',
  enabled: false,
  title: '',
  message: '',
  imageUrl: '',
  images: [],
  ctaLabel: '',
  ctaHref: '',
  startsAt: '',
  endsAt: '',
  updatedAt: '',
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function normalizeImages(value: unknown): AnnouncementImage[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const image = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      return {
        url: text(image.url, 500),
        alt: text(image.alt, 120),
        href: text(image.href, 500),
      }
    })
    .filter((image) => Boolean(image.url))
    .slice(0, MAX_ANNOUNCEMENT_IMAGES)
}

export function normalizeAnnouncement(value: unknown): Announcement {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    id: text(source.id, 40),
    enabled: source.enabled === true,
    title: text(source.title, 120),
    message: text(source.message, 600),
    imageUrl: text(source.imageUrl, 500),
    images: normalizeImages(source.images),
    ctaLabel: text(source.ctaLabel, 60),
    ctaHref: text(source.ctaHref, 500),
    startsAt: text(source.startsAt, 10),
    endsAt: text(source.endsAt, 10),
    updatedAt: text(source.updatedAt, 40),
  }
}

/** El dia del visitante, en su zona horaria: la vigencia se lee como en el calendario. */
export function announcementDayStamp(now: Date): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Un aviso sin titulo o sin texto no se muestra, aunque este activado. */
export function isAnnouncementLive(announcement: Announcement | null | undefined, now: Date): boolean {
  if (!announcement?.enabled) return false
  if (!announcement.title.trim() || !announcement.message.trim()) return false

  const today = announcementDayStamp(now)
  if (announcement.startsAt && today < announcement.startsAt) return false
  if (announcement.endsAt && today > announcement.endsAt) return false
  return true
}

/**
 * Las imagenes del aviso. Los avisos viejos guardaban una sola en `imageUrl`:
 * se sigue mostrando sin necesidad de migrar nada.
 */
export function announcementImages(announcement: Announcement | null | undefined): AnnouncementImage[] {
  if (!announcement) return []
  if (announcement.images.length > 0) return announcement.images
  return announcement.imageUrl ? [{ url: announcement.imageUrl, alt: '', href: '' }] : []
}

/** Una clave por aviso: al editarlo cambia y el cartel vuelve a aparecer. */
export function announcementStorageKey(scope: string, announcement: Announcement): string {
  return `aviso:${scope}:${announcement.id || 'unico'}:${announcement.updatedAt || 'v0'}`
}

/**
 * La lista de avisos cargados, recortada al tope. Acepta tambien un aviso
 * suelto: asi se leen los que se guardaron cuando habia uno solo.
 */
export function normalizeAnnouncementList(value: unknown, max: number): Announcement[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : []

  return entries
    .map((entry, index) => {
      const announcement = normalizeAnnouncement(entry)
      // Los avisos viejos no tenian id: se les da uno estable por posicion.
      return announcement.id ? announcement : { ...announcement, id: `aviso-${index + 1}` }
    })
    .filter((announcement) => announcement.title || announcement.message || announcement.images.length > 0)
    .slice(0, Math.max(1, max))
}

/**
 * Cual se muestra: el primero vigente de la lista. Si hay varios, los demas
 * esperan su turno; dos carteles seguidos al entrar serian peor que ninguno.
 */
export function pickLiveAnnouncement(
  announcements: Announcement[] | null | undefined,
  now: Date,
): Announcement | null {
  return (announcements ?? []).find((announcement) => isAnnouncementLive(announcement, now)) ?? null
}

export type AnnouncementStatus = 'activo' | 'programado' | 'vencido' | 'incompleto' | 'apagado'

/** En que esta cada aviso de la lista, para mostrarlo en el editor. */
export function announcementStatus(announcement: Announcement, now: Date): AnnouncementStatus {
  if (!announcement.enabled) return 'apagado'
  if (!announcement.title.trim() || !announcement.message.trim()) return 'incompleto'

  const today = announcementDayStamp(now)
  if (announcement.startsAt && today < announcement.startsAt) return 'programado'
  if (announcement.endsAt && today > announcement.endsAt) return 'vencido'
  return 'activo'
}

/**
 * Se muestra una vez por dia: si el visitante ya lo cerro hoy, no vuelve a
 * aparecer hasta mañana.
 */
export function shouldShowAnnouncement(
  announcement: Announcement | null | undefined,
  now: Date,
  lastSeen: string | null,
): boolean {
  if (!isAnnouncementLive(announcement, now)) return false
  return lastSeen !== announcementDayStamp(now)
}

/** Un enlace del aviso: interno, externo, o ninguno si no es seguro. */
export function announcementCtaKind(href: string): 'internal' | 'external' | 'none' {
  const target = href.trim()
  if (target.startsWith('/')) return 'internal'
  if (/^https?:\/\//i.test(target)) return 'external'
  return 'none'
}
