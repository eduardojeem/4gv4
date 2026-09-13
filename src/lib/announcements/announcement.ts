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

export type AnnouncementFrequency = 'always' | 'once_per_day' | 'once_per_session'

export type AnnouncementBadgeVariant =
  | 'primary'
  | 'amber'
  | 'emerald'
  | 'purple'
  | 'rose'
  | 'cyan'
  | 'indigo'
  | 'orange'
  | 'teal'
  | 'slate'

export type AnnouncementCarouselAnimation = 'slide' | 'fade' | 'zoom'

export type AnnouncementImageBackdrop = 'ambient' | 'dark' | 'tinted' | 'light'

export type AnnouncementImageFit = 'contain' | 'cover'

export type AnnouncementImageEffect = 'zoom' | 'glow' | 'none'

export type Announcement = {
  /** Identifica al aviso dentro de la lista, para editarlo o borrarlo. */
  id: string
  enabled: boolean
  title: string
  message: string
  /** Etiqueta destacada personalizable (ej: "✨ Novedad", "🔥 Oferta especial", "🚀 Lanzamiento"). */
  badgeLabel?: string
  /** Color o estilo del badge destacado. */
  badgeVariant?: AnnouncementBadgeVariant
  /** Nota o texto pequeño de pie (ej: "* Válido hasta agotar stock", "Cupos limitados"). */
  highlightNote?: string
  /** Efecto de animación en la transición de imágenes ('slide' | 'fade' | 'zoom'). */
  carouselAnimation?: AnnouncementCarouselAnimation
  /** Segundos de rotación automática entre imágenes (0 = manual). Por defecto: 3s. */
  carouselIntervalSeconds?: number
  /** Fondo ambiental del carrusel/imagen ('ambient' | 'dark' | 'tinted' | 'light'). */
  imageBackdrop?: AnnouncementImageBackdrop
  /** Modo de ajuste de la imagen ('contain' | 'cover'). */
  imageFit?: AnnouncementImageFit
  /** Efecto visual/interactivo en la imagen ('zoom' | 'glow' | 'none'). */
  imageEffect?: AnnouncementImageEffect
  /** Frecuencia con la que se muestra el aviso al visitante. Por defecto: una vez por día. */
  frequency?: AnnouncementFrequency
  /** Tiempo en segundos antes del auto-cierre del cartel (0 = sin auto-cierre). Por defecto: 5 segundos. */
  autoCloseSeconds?: number
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
  badgeLabel: 'Novedad destacada',
  badgeVariant: 'primary',
  highlightNote: '',
  carouselAnimation: 'slide',
  carouselIntervalSeconds: 3,
  imageBackdrop: 'ambient',
  imageFit: 'contain',
  imageEffect: 'zoom',
  frequency: 'once_per_day',
  autoCloseSeconds: 5,
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
  const rawFreq = source.frequency
  const frequency: AnnouncementFrequency =
    rawFreq === 'always' || rawFreq === 'once_per_session' ? rawFreq : 'once_per_day'

  const rawSeconds = source.autoCloseSeconds
  const autoCloseSeconds =
    typeof rawSeconds === 'number' && Number.isFinite(rawSeconds)
      ? Math.max(0, Math.min(120, Math.round(rawSeconds)))
      : (rawSeconds === 0 ? 0 : 5)

  const rawBadgeVariant = source.badgeVariant
  const badgeVariant: AnnouncementBadgeVariant =
    rawBadgeVariant === 'amber' ||
    rawBadgeVariant === 'emerald' ||
    rawBadgeVariant === 'purple' ||
    rawBadgeVariant === 'rose' ||
    rawBadgeVariant === 'cyan' ||
    rawBadgeVariant === 'indigo' ||
    rawBadgeVariant === 'orange' ||
    rawBadgeVariant === 'teal' ||
    rawBadgeVariant === 'slate'
      ? rawBadgeVariant
      : 'primary'

  const rawAnimation = source.carouselAnimation
  const carouselAnimation: AnnouncementCarouselAnimation =
    rawAnimation === 'fade' || rawAnimation === 'zoom' ? rawAnimation : 'slide'

  const rawCarouselSeconds = source.carouselIntervalSeconds
  const carouselIntervalSeconds =
    typeof rawCarouselSeconds === 'number' && Number.isFinite(rawCarouselSeconds)
      ? Math.max(0, Math.min(30, Math.round(rawCarouselSeconds)))
      : (rawCarouselSeconds === 0 ? 0 : 3)

  const rawBackdrop = source.imageBackdrop
  const imageBackdrop: AnnouncementImageBackdrop =
    rawBackdrop === 'dark' || rawBackdrop === 'tinted' || rawBackdrop === 'light'
      ? rawBackdrop
      : 'ambient'

  const rawFit = source.imageFit
  const imageFit: AnnouncementImageFit = rawFit === 'cover' ? 'cover' : 'contain'

  const rawEffect = source.imageEffect
  const imageEffect: AnnouncementImageEffect =
    rawEffect === 'glow' || rawEffect === 'none' ? rawEffect : 'zoom'

  return {
    id: text(source.id, 40),
    enabled: source.enabled === true,
    title: text(source.title, 120),
    message: text(source.message, 600),
    badgeLabel: text(source.badgeLabel ?? 'Novedad destacada', 40),
    badgeVariant,
    highlightNote: text(source.highlightNote, 120),
    carouselAnimation,
    carouselIntervalSeconds,
    imageBackdrop,
    imageFit,
    imageEffect,
    frequency,
    autoCloseSeconds,
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
 * Evalúa si se debe mostrar el aviso según su frecuencia configurada:
 * - 'always': siempre que esté vigente (en cada recarga/visita).
 * - 'once_per_session': una vez por sesión del navegador.
 * - 'once_per_day': una vez por día (si ya lo cerró hoy, no vuelve hasta mañana).
 */
export function shouldShowAnnouncement(
  announcement: Announcement | null | undefined,
  now: Date,
  lastSeen: string | null,
  sessionSeen?: boolean,
): boolean {
  if (!isAnnouncementLive(announcement, now)) return false
  const frequency = announcement?.frequency ?? 'once_per_day'
  if (frequency === 'always') return true
  if (frequency === 'once_per_session') return !sessionSeen
  return lastSeen !== announcementDayStamp(now)
}

/** Un enlace del aviso: interno, externo, o ninguno si no es seguro. */
export function announcementCtaKind(href: string): 'internal' | 'external' | 'none' {
  const target = href.trim()
  if (target.startsWith('/')) return 'internal'
  if (/^https?:\/\//i.test(target)) return 'external'
  return 'none'
}
