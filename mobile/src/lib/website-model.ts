/**
 * Modelo del «Sitio web» en la app: el MISMO que edita la web en /admin/website
 * (tabla website_settings, una fila por organización y clave). Este archivo no
 * importa React Native: es lógica pura, probada desde src/test.
 *
 * Reglas que importan para no perder datos:
 * - `PUT /api/admin/website/settings` y `sync-company` REEMPLAZAN el objeto de
 *   cada clave. Por eso los cambios se mezclan siempre sobre lo cargado del
 *   servidor y se manda el objeto completo, con los campos que la app no toca.
 * - `undefined` nunca pisa un valor guardado: significa «sin cambios».
 */

export type CompanyInfo = {
  name?: string;
  slogan?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  mapsUrl?: string;
  hours?: { weekdays?: string; saturday?: string; sunday?: string };
  logoUrl?: string;
  brandColor?: string;
  customBrandColor?: string;
  headerStyle?: 'glass' | 'solid' | 'accent' | 'dark';
  storefrontStyle?: string;
  showTopBar?: boolean;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  marketplacePublic?: boolean;
  storefrontPublic?: boolean;
  processSectionEnabled?: boolean;
  slug?: string;
  [key: string]: unknown;
};

export type HeroContent = {
  enabled?: boolean;
  badge?: string;
  title?: string;
  subtitle?: string;
  ctaPrimaryText?: string;
  ctaSecondaryText?: string;
  [key: string]: unknown;
};

export type CarouselSlide = {
  id: string;
  title: string;
  message: string;
  imageUrl: string;
  imageAlt: string;
  ctaText?: string;
  ctaHref?: string;
  active: boolean;
  contentAlign?: 'left' | 'center' | 'right';
  textTone?: 'light' | 'dark';
  hideText?: boolean;
  [key: string]: unknown;
};

export type PromotionalCarousel = {
  enabled: boolean;
  autoplay: boolean;
  intervalSeconds: number;
  slides: CarouselSlide[];
  [key: string]: unknown;
};

export type BookingSection = {
  enabled: boolean;
  title: string;
  subtitle: string;
  badge?: string;
  showTeam?: boolean;
  [key: string]: unknown;
};

export const DEFAULT_BOOKING_SECTION: BookingSection = {
  enabled: false,
  title: 'Reservá tu turno',
  subtitle: 'Elegí el servicio, el día y el horario que te quede cómodo.',
  badge: 'Turnos online',
  showTeam: true,
};

export const BOOKING_PRESETS = [
  {
    id: 'tech',
    name: 'Taller / Soporte Técnico',
    icon: 'hammer-outline' as const,
    badge: 'Atención en taller',
    title: 'Agendá tu cita técnica o diagnóstico',
    subtitle: 'Reservá un horario para revisar tu equipo, solicitar presupuesto o consultar con un técnico sin esperas.',
  },
  {
    id: 'vip',
    name: 'Asesoramiento / Compra VIP',
    icon: 'bag-handle-outline' as const,
    badge: 'Atención personalizada',
    title: 'Agendá una cita de compra o demostración',
    subtitle: 'Coordiná una atención exclusiva 1 a 1 para cotizaciones, ver equipos o armar tu configuración.',
  },
  {
    id: 'pickup',
    name: 'Retiro o Entrega Programada',
    icon: 'cube-outline' as const,
    badge: 'Visita programada',
    title: 'Coordiná tu visita o retiro',
    subtitle: 'Elegí el día y horario que mejor te quede para retirar tus compras o dejar tu equipo sin esperas.',
  },
  {
    id: 'personal',
    name: 'Turnos & Servicios Personales',
    icon: 'cut-outline' as const,
    badge: 'Turnos online',
    title: 'Reservá tu turno',
    subtitle: 'Elegí el servicio, quién te atiende y el horario que te quede más cómodo.',
  },
] as const;

export type WebsiteSettings = {
  company_info: CompanyInfo;
  hero_content?: HeroContent;
  promotional_carousel?: PromotionalCarousel;
  booking_section?: BookingSection;
  checkout?: { commerceMode?: 'cart' | 'whatsapp' | 'catalog'; [key: string]: unknown };
  [key: string]: unknown;
};

/** Claves que la app puede guardar por `PUT /settings` (la empresa va por sync-company). */
export const EDITABLE_SETTING_KEYS = [
  'hero_content', 'hero_stats', 'trust_bar', 'promotional_carousel', 'offers_section',
  'brands_section', 'booking_section', 'gallery_section',
] as const;
export type EditableSettingKey = (typeof EDITABLE_SETTING_KEYS)[number];

// ─── Mezcla y comparación ──────────────────────────────────────────────────

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Copia sin las claves `undefined` (que significan «sin cambios»). */
export function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

/**
 * Lo guardado más lo editado. Los objetos anidados se mezclan (p. ej. `hours`),
 * las listas se reemplazan enteras y `undefined` no borra nada.
 */
export function mergeSetting<T extends Record<string, unknown>>(current: T | null | undefined, patch: Partial<T>): T {
  const base: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    base[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeSetting(base[key] as Record<string, unknown>, value)
      : value;
  }
  return base as T;
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      // Ausente y `undefined` son lo mismo; '' y undefined también (campo vacío).
      const left = a[key] === '' ? undefined : a[key];
      const right = b[key] === '' ? undefined : b[key];
      if (!sameValue(left, right)) return false;
    }
    return true;
  }
  return false;
}

/** ¿Lo editado difiere de lo guardado? (para «Cambios sin guardar») */
export const isDirty = (saved: unknown, edited: unknown) => !sameValue(saved, edited);

// ─── Empresa (sync-company) ────────────────────────────────────────────────

/**
 * El cuerpo de `PUT /api/admin/website/sync-company`: la empresa completa, con
 * los mismos valores por defecto que manda la web (CompanyInfoForm), para que
 * un guardado desde la app no apague ni vacíe nada que la app no muestra.
 */
export function buildCompanyPayload(saved: CompanyInfo, patch: Partial<CompanyInfo>, publicationConfirmed = false) {
  const merged = mergeSetting<CompanyInfo>(saved, patch);
  const storefrontPublic = merged.storefrontPublic === true;
  return withoutUndefined({
    ...merged,
    name: (merged.name ?? '').trim(),
    hours: { weekdays: '', saturday: '', sunday: '', ...(merged.hours ?? {}) },
    logoUrl: merged.logoUrl || '',
    mapsUrl: merged.mapsUrl?.trim() || '',
    brandColor: merged.brandColor || 'blue',
    customBrandColor: merged.customBrandColor || '',
    headerStyle: merged.headerStyle || 'glass',
    showTopBar: merged.showTopBar !== undefined ? merged.showTopBar : true,
    storefrontStyle: merged.storefrontStyle || 'auto',
    whatsapp: merged.whatsapp || '',
    slogan: merged.slogan || '',
    description: merged.description || '',
    instagram: merged.instagram || '',
    facebook: merged.facebook || '',
    tiktok: merged.tiktok || '',
    storefrontPublic,
    marketplacePublic: storefrontPublic && merged.marketplacePublic === true,
    slug: merged.slug || '',
    publicationConfirmed,
  });
}

/** ¿Este guardado prende la tienda o el marketplace? Necesita confirmación. */
export function isActivatingPublication(saved: CompanyInfo, next: Partial<CompanyInfo>) {
  return (next.storefrontPublic === true && saved.storefrontPublic !== true)
    || (next.marketplacePublic === true && next.storefrontPublic !== false && saved.marketplacePublic !== true);
}

/** Lo mismo que exige el servidor para publicar (src/lib/website/publication.ts). */
export function publicationIssues(company: CompanyInfo, mode: 'cart' | 'whatsapp' | 'catalog' = 'cart'): string[] {
  const issues: string[] = [];
  if (!company.name || company.name.trim().length < 2) issues.push('Completá el nombre comercial.');
  if ((company.phone?.replace(/\D/g, '').length ?? 0) < 6) issues.push('Completá un teléfono de contacto válido.');
  const whatsapp = (company.whatsapp || company.phone || '').replace(/\D/g, '');
  if (mode === 'whatsapp' && whatsapp.length < 6) issues.push('Cargá un WhatsApp válido (por ejemplo 0981 123456) para recibir consultas.');
  return issues;
}

// ─── Validaciones (espejo de src/lib/validation/website-settings.ts) ───────

/** Una ruta de la tienda (`/ofertas`) o una dirección http(s). Nada de `javascript:`. */
export function isSafeLinkOrPath(value: string | null | undefined): boolean {
  const target = (value ?? '').trim();
  if (!target) return true;
  if (target.startsWith('//')) return false;
  return target.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(target);
}

export const isValidHexColor = (value: string | null | undefined) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value ?? '');
export const isValidEmail = (value: string | null | undefined) => !value?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';
const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};
export const SOCIAL_BASE: Record<SocialPlatform, string> = {
  instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://tiktok.com/@',
};

/** El usuario sin arroba ni dominio: igual que src/lib/public/social-links.ts. */
export function socialHandle(value: string | null | undefined, platform: SocialPlatform): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  let rest = raw.replace(/^https?:\/\//i, '');
  for (const host of SOCIAL_HOSTS[platform]) {
    if (rest.toLowerCase().startsWith(`${host}/`)) { rest = rest.slice(host.length + 1); break; }
  }
  return rest.replace(/^@/, '').replace(/^\/+/, '').replace(/[/?#].*$/, '').trim();
}

export const isValidSocial = (value: string | null | undefined, platform: SocialPlatform) =>
  !value?.trim() || /^[A-Za-z0-9._-]{1,60}$/.test(socialHandle(value, platform));

export function isValidGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'maps.app.goo.gl') return true;
    if (host === 'goo.gl' && url.pathname.startsWith('/maps')) return true;
    return /^(www\.|maps\.)?google\.[a-z.]{2,6}$/.test(host) && (url.pathname.startsWith('/maps') || host.startsWith('maps.'));
  } catch {
    return false;
  }
}

/** Formato y largo; las direcciones reservadas las rechaza el servidor. */
export function slugIssue(value: string): string | null {
  const slug = value.trim();
  if (slug.length < 3) return 'La dirección debe tener al menos 3 caracteres.';
  if (slug.length > 50) return 'La dirección no puede superar 50 caracteres.';
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Usá solo letras minúsculas, números y guiones.';
  return null;
}

export function companyIssues(company: CompanyInfo): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!company.name || company.name.trim().length < 2) issues.name = 'El nombre debe tener al menos 2 caracteres.';
  if (!isValidEmail(company.email)) issues.email = 'Ingresá un email válido.';
  if (company.phone?.trim() && company.phone.replace(/\D/g, '').length < 6) issues.phone = 'El teléfono debe tener al menos 6 dígitos.';
  if (!isValidGoogleMapsUrl(company.mapsUrl)) issues.mapsUrl = 'Ingresá un enlace HTTPS de Google Maps.';
  for (const platform of ['instagram', 'facebook', 'tiktok'] as const) {
    if (!isValidSocial(company[platform], platform)) issues[platform] = 'Ingresá el usuario (@tienda) o el enlace del perfil.';
  }
  if (company.brandColor === 'custom' && !isValidHexColor(company.customBrandColor)) issues.customBrandColor = 'Usá un color HEX, por ejemplo #2563EB.';
  if (company.slug !== undefined && company.slug !== '' && slugIssue(company.slug)) issues.slug = slugIssue(company.slug)!;
  return issues;
}

export function heroIssues(hero: HeroContent): Record<string, string> {
  if (hero.enabled === false) return {};
  const issues: Record<string, string> = {};
  if ((hero.badge ?? '').trim().length < 3) issues.badge = 'La etiqueta debe tener al menos 3 caracteres.';
  if ((hero.title ?? '').trim().length < 10) issues.title = 'El título debe tener al menos 10 caracteres.';
  if ((hero.subtitle ?? '').trim().length < 10) issues.subtitle = 'El subtítulo debe tener al menos 10 caracteres.';
  return issues;
}

export function slideIssues(slide: CarouselSlide): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!slide.imageUrl || !isSafeLinkOrPath(slide.imageUrl)) issues.imageUrl = 'Elegí una imagen para el banner.';
  if ((slide.imageAlt ?? '').trim().length < 3) issues.imageAlt = 'Describí la imagen (mínimo 3 caracteres).';
  if (!isSafeLinkOrPath(slide.ctaHref)) issues.ctaHref = 'Usá una ruta de tu tienda (/ofertas) o una dirección http(s).';
  if (!slide.hideText && Boolean(slide.ctaText?.trim()) !== Boolean(slide.ctaHref?.trim())) {
    issues.ctaText = 'Completá el texto y el enlace del botón, o dejá ambos vacíos.';
  }
  return issues;
}

export function bookingIssues(booking: Partial<BookingSection>): Record<string, string> {
  const issues: Record<string, string> = {};
  if (booking.enabled !== false) {
    if (!booking.title || booking.title.trim().length < 2) issues.title = 'El título debe tener al menos 2 caracteres.';
    if (booking.title && booking.title.length > 100) issues.title = 'El título no puede superar los 100 caracteres.';
    if (booking.subtitle && booking.subtitle.length > 300) issues.subtitle = 'La descripción no puede superar los 300 caracteres.';
    if (booking.badge && booking.badge.length > 60) issues.badge = 'La etiqueta no puede superar los 60 caracteres.';
  }
  return issues;
}

// ─── Listas ────────────────────────────────────────────────────────────────

/** Mueve un elemento una posición (Subir/Bajar). Fuera de rango, no cambia nada. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const newSlideId = () => `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function emptySlide(): CarouselSlide {
  return { id: newSlideId(), title: '', message: '', imageUrl: '', imageAlt: '', ctaText: '', ctaHref: '', active: true, contentAlign: 'left', textTone: 'light', hideText: false };
}

// ─── Tienda pública ────────────────────────────────────────────────────────

export function publicStoreUrl(siteUrl: string, slug: string | null | undefined): string | null {
  const clean = (slug ?? '').trim();
  if (!clean) return null;
  return `${siteUrl.replace(/\/+$/, '')}/${encodeURIComponent(clean)}`;
}

/**
 * Lo que la pantalla de destacados guarda de cada producto: solo datos que ya
 * muestra la tienda pública. Nunca el costo, el margen ni datos internos (S1),
 * aunque la API se los devuelva al dueño.
 */
export type PublicProduct = {
  id: string;
  name: string;
  salePrice: number;
  offerPrice: number | null;
  image: string | null;
  isActive: boolean;
  featured: boolean;
  stock: number | null;
};

export function toPublicProduct(raw: Record<string, unknown>): PublicProduct {
  const images = Array.isArray(raw.images) ? (raw.images as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const number = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    salePrice: number(raw.sale_price) ?? 0,
    offerPrice: raw.has_offer ? number(raw.offer_price) : null,
    image: (typeof raw.image_url === 'string' && raw.image_url) || images[0] || null,
    isActive: raw.is_active !== false,
    featured: raw.featured === true,
    stock: number(raw.stock_quantity),
  };
}

// ─── Apariencia ────────────────────────────────────────────────────────────

/** Los colores de marca de la web (Tailwind 500), para la vista previa en la app. */
export const BRAND_COLORS: readonly { key: string; name: string; hex: string }[] = [
  { key: 'blue', name: 'Azul', hex: '#3B82F6' }, { key: 'green', name: 'Verde', hex: '#22C55E' },
  { key: 'purple', name: 'Morado', hex: '#A855F7' }, { key: 'orange', name: 'Naranja', hex: '#F97316' },
  { key: 'red', name: 'Rojo', hex: '#EF4444' }, { key: 'indigo', name: 'Índigo', hex: '#6366F1' },
  { key: 'teal', name: 'Teal', hex: '#14B8A6' }, { key: 'rose', name: 'Rosa', hex: '#F43F5E' },
  { key: 'amber', name: 'Ámbar', hex: '#F59E0B' }, { key: 'emerald', name: 'Esmeralda', hex: '#10B981' },
  { key: 'cyan', name: 'Cian', hex: '#06B6D4' }, { key: 'sky', name: 'Cielo', hex: '#0EA5E9' },
];

export function brandHex(company: Pick<CompanyInfo, 'brandColor' | 'customBrandColor'>): string {
  if (company.brandColor === 'custom' && isValidHexColor(company.customBrandColor)) return company.customBrandColor!;
  return BRAND_COLORS.find((color) => color.key === company.brandColor)?.hex ?? BRAND_COLORS[0].hex;
}

export const STOREFRONT_STYLES: readonly { value: string; label: string; description: string }[] = [
  { value: 'auto', label: 'Automático', description: 'Se elige según el rubro de tu negocio.' },
  { value: 'classic', label: 'Clásico', description: 'Tarjetas apaisadas con la foto completa.' },
  { value: 'fashion', label: 'Moda', description: 'Fotos verticales y títulos elegantes.' },
  { value: 'sport', label: 'Deportivo', description: 'Títulos grandes y más contraste.' },
  { value: 'tech', label: 'Tecnología', description: 'Foco en dispositivos y servicio técnico.' },
  { value: 'market', label: 'Supermercado', description: 'Pasillos, descuentos y compra rápida.' },
  { value: 'modern', label: 'Moderno', description: 'Bordes suaves y estilo limpio.' },
  { value: 'services', label: 'Servicios', description: 'Servicios con precio y turnos al frente.' },
  { value: 'beauty', label: 'Belleza', description: 'Cosmética, skincare y rutinas.' },
];

export const HEADER_STYLES: readonly { value: 'solid' | 'accent' | 'dark'; label: string; description: string }[] = [
  { value: 'solid', label: 'Claro', description: 'Fondo blanco. Funciona con cualquier logo.' },
  { value: 'accent', label: 'Color de marca', description: 'Fondo con tu color. Ideal con logo blanco.' },
  { value: 'dark', label: 'Oscuro', description: 'Fondo negro, contraste premium.' },
];

// ─── Secciones del inicio ──────────────────────────────────────────────────

/**
 * Las secciones que la tienda muestra en el inicio y su interruptor real. El
 * orden lo fija la plantilla de la tienda: no hay un orden configurable que
 * guardar, así que la app no ofrece reordenarlas.
 */
export type HomeSection = {
  id: string;
  label: string;
  hint: string;
  /** Dónde vive el interruptor. */
  setting: 'company_info' | EditableSettingKey;
  field: string;
  /** El valor cuando nunca se guardó (el de la tienda). */
  defaultOn: boolean;
};

export const HOME_SECTIONS: readonly HomeSection[] = [
  { id: 'hero', label: 'Portada', hint: 'Titular y botones de inicio', setting: 'hero_content', field: 'enabled', defaultOn: true },
  { id: 'hero_stats', label: 'Cifras de la portada', hint: 'Números destacados bajo el título', setting: 'hero_stats', field: 'enabled', defaultOn: true },
  { id: 'trust_bar', label: 'Beneficios', hint: 'Garantías y envíos', setting: 'trust_bar', field: 'enabled', defaultOn: false },
  { id: 'carousel', label: 'Banners promocionales', hint: 'Campañas rotativas', setting: 'promotional_carousel', field: 'enabled', defaultOn: false },
  { id: 'offers', label: 'Ofertas', hint: 'Productos con descuento', setting: 'offers_section', field: 'enabled', defaultOn: false },
  { id: 'brands', label: 'Marcas destacadas', hint: 'Marquesina de marcas', setting: 'brands_section', field: 'enabled', defaultOn: false },
  { id: 'booking', label: 'Reservas y citas online', hint: 'Turnos, citas técnicas o asesoramiento en el inicio', setting: 'booking_section', field: 'enabled', defaultOn: false },
  { id: 'gallery', label: 'Galería de fotos', hint: 'Imágenes destacadas de trabajos o local', setting: 'gallery_section', field: 'enabled', defaultOn: false },
  { id: 'process', label: 'Cómo comprar', hint: 'Pasos de atención', setting: 'company_info', field: 'processSectionEnabled', defaultOn: true },
];

export function sectionEnabled(settings: WebsiteSettings, section: HomeSection): boolean {
  const holder = settings[section.setting] as Record<string, unknown> | undefined;
  const value = holder?.[section.field];
  return typeof value === 'boolean' ? value : section.defaultOn;
}
