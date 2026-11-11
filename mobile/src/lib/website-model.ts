/**
 * Modelo del «Sitio web» en la app: el MISMO contrato JSON que edita la web en
 * /admin/website (tabla `website_settings`, una fila por organización y clave).
 *
 * REGLA CRÍTICA DE ARQUITECTURA:
 * Este archivo NO importa `react-native` ni `expo-*`. Es lógica 100% pura
 * (tipos, validaciones, defaults, asistentes y catálogos), probada directo desde
 * `src/test/` en Vitest sin emulador.
 *
 * Reglas que importan para no perder datos:
 * - `PUT /api/admin/website/settings` y `PUT /api/admin/website/sync-company`
 *   REEMPLAZAN el objeto de cada clave. Por eso los cambios se mezclan siempre
 *   sobre lo cargado del servidor y se manda el objeto completo, conservando
 *   los campos que la app no tocó.
 * - `undefined` nunca pisa un valor guardado: significa «sin cambios».
 */

// ─── Tipos de negocio y módulos (espejo de business-profile / subscription-service) ─

export type BusinessVertical =
  | 'general'
  | 'clothing'
  | 'barbershop'
  | 'beauty_services'
  | 'cosmetics'
  | 'electronics'
  | 'food'
  | 'hardware'
  | 'other';

export type OperatingModel = 'retail' | 'service' | 'repair' | 'mixed';

export type OrganizationModule =
  | 'pos'
  | 'inventory'
  | 'customers'
  | 'orders'
  | 'delivery'
  | 'quotes'
  | 'after_sales'
  | 'repairs'
  | 'services'
  | 'credits'
  | 'promotions'
  | 'ecommerce'
  | 'cash_register'
  | 'suppliers'
  | 'analytics'
  | 'reports';

export type ServiceSpecialty =
  | 'barbering'
  | 'hair'
  | 'nails'
  | 'lashes'
  | 'brows'
  | 'makeup'
  | 'aesthetics'
  | 'other';

export type ServiceWebsiteVariant = 'barber' | 'salon' | 'studio' | 'professional';

export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

// ─── Entidades de website_settings ───────────────────────────────────────────

export type CompanyInfo = {
  name?: string;
  slogan?: string;
  description?: string;
  ruc?: string;
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
  storefrontVariant?: string;
  serviceWebsiteVariant?: ServiceWebsiteVariant;
  serviceSpecialties?: (ServiceSpecialty | (string & {}))[];
  showTopBar?: boolean;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  marketplacePublic?: boolean;
  storefrontPublic?: boolean;
  servicesPageEnabled?: boolean;
  repairTrackingEnabled?: boolean;
  processSectionEnabled?: boolean;
  slug?: string;
  [key: string]: unknown;
};

export type HeroContent = {
  enabled?: boolean;
  badge?: string;
  title?: string;
  subtitle?: string;
  trustBadges?: string[];
  ctaPrimaryText?: string;
  ctaSecondaryText?: string;
  trackRepairText?: string;
  [key: string]: unknown;
};

export type HeroStats = {
  enabled?: boolean;
  displayMode?: 'stats' | 'social' | 'both';
  showSocial?: boolean;
  repairs?: string;
  satisfaction?: string;
  avgTime?: string;
  labels?: {
    repairs?: string;
    satisfaction?: string;
    avgTime?: string;
  };
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
  badge?: string;
  titleSize?: 'compact' | 'normal' | 'large';
  overlayIntensity?: 'none' | 'subtle' | 'medium' | 'strong';
  overlayColor?: 'black' | 'white' | 'brand';
  backgroundColor?: string;
  titleColor?: string;
  fontFamily?: 'sans' | 'display' | 'serif' | 'mono';
  [key: string]: unknown;
};

export type PromotionalCarousel = {
  enabled: boolean;
  autoplay: boolean;
  intervalSeconds: number;
  layoutMode?: 'contained' | 'full' | 'compact';
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

export type CommerceMode = 'cart' | 'whatsapp' | 'catalog';

export type BankTransferOption = {
  id: string;
  bankName: string;
  alias?: string;
  accountNumber?: string;
  accountHolder?: string;
};

export type PaymentMethodConfig = {
  enabled: boolean;
  label?: string;
  instructions?: string;
  bankAlias?: string;
  bankCbu?: string;
  bankName?: string;
  transferOptions?: BankTransferOption[];
  walletAlias?: string;
  qrImageUrl?: string;
  [key: string]: unknown;
};

export type DeliveryZoneOption = {
  id: string;
  name: string;
  cost: number;
};

export type CheckoutSettings = {
  commerceMode: CommerceMode;
  payment: {
    cash: PaymentMethodConfig;
    card: PaymentMethodConfig;
    transfer: PaymentMethodConfig;
    digital_wallet: PaymentMethodConfig;
    [key: string]: PaymentMethodConfig;
  };
  delivery: {
    enabled: boolean;
    defaultCost: number;
    freeThreshold: number;
    estimatedTime: string;
    zoneOptions?: DeliveryZoneOption[];
    zones?: string;
    instructions?: string;
    [key: string]: unknown;
  };
  pickup: {
    enabled: boolean;
    estimatedTime: string;
    instructions?: string;
    [key: string]: unknown;
  };
  minOrderAmount: number;
  confirmationMessage?: string;
  [key: string]: unknown;
};

export type OffersAccentColor =
  | 'brand'
  | 'rose'
  | 'amber'
  | 'orange'
  | 'emerald'
  | 'blue'
  | 'sky'
  | 'violet'
  | 'fuchsia'
  | 'red'
  | 'teal';

export type OffersCarouselConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  autoplay: boolean;
  intervalSeconds: number;
  maxItems: number;
};

export type OffersSectionSettings = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  accentColor: OffersAccentColor;
  carousel?: OffersCarouselConfig;
  [key: string]: unknown;
};

export type TrustBarItem = {
  id?: string;
  icon: string;
  title: string;
  description?: string;
  active?: boolean;
};

export type TrustBarPosition = 'above_carousel' | 'below_carousel' | 'bottom';

export type TrustBarSettings = {
  enabled: boolean;
  position?: TrustBarPosition;
  items: TrustBarItem[];
  [key: string]: unknown;
};

export type BrandItem = {
  id: string;
  name: string;
  active: boolean;
  imageUrl?: string;
  href?: string;
};

export type BrandsSectionSettings = {
  enabled: boolean;
  title: string;
  subtitle?: string;
  items: BrandItem[];
  showOnHome?: boolean;
  showOnProducts?: boolean;
  showOnOffers?: boolean;
  [key: string]: unknown;
};

export type AnnouncementFrequency = 'always' | 'once_per_day' | 'once_per_session';
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
  | 'slate';
export type AnnouncementCarouselAnimation = 'slide' | 'fade' | 'zoom';
export type AnnouncementImageBackdrop = 'ambient' | 'dark' | 'tinted' | 'light';
export type AnnouncementImageFit = 'contain' | 'cover';
export type AnnouncementImageEffect = 'zoom' | 'glow' | 'none';
export type AnnouncementStatus = 'activo' | 'programado' | 'vencido' | 'incompleto' | 'apagado';

export type AnnouncementImage = {
  url: string;
  alt: string;
  href: string;
};

export type Announcement = {
  id: string;
  enabled: boolean;
  title: string;
  message: string;
  badgeLabel?: string;
  badgeVariant?: AnnouncementBadgeVariant;
  highlightNote?: string;
  carouselAnimation?: AnnouncementCarouselAnimation;
  carouselIntervalSeconds?: number;
  imageBackdrop?: AnnouncementImageBackdrop;
  imageFit?: AnnouncementImageFit;
  imageEffect?: AnnouncementImageEffect;
  frequency?: AnnouncementFrequency;
  autoCloseSeconds?: number;
  imageUrl: string;
  images: AnnouncementImage[];
  ctaLabel: string;
  ctaHref: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
};

export type GalleryImage = {
  id: string;
  url: string;
  path?: string;
  caption?: string;
};

export type GallerySectionSettings = {
  enabled: boolean;
  title: string;
  subtitle: string;
  images: GalleryImage[];
  [key: string]: unknown;
};

export type ProcessStep = {
  id: string;
  number: number;
  title: string;
  description: string;
};

export type ProcessFlow = {
  id: string;
  title: string;
  description?: string;
  active?: boolean;
  steps: ProcessStep[];
};

export type ServiceIcon =
  | 'smartphone'
  | 'monitor'
  | 'battery'
  | 'cpu'
  | 'zap'
  | 'wrench'
  | 'shield'
  | 'package'
  | 'headset'
  | 'laptop'
  | 'clock'
  | 'sparkles'
  | 'droplet'
  | 'camera'
  | 'microchip'
  | 'receipt'
  | 'wallet'
  | 'landmark'
  | 'banknote'
  | 'credit-card';

export type ServiceColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'indigo'
  | 'teal'
  | 'yellow'
  | 'cyan'
  | 'pink'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'sky';

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  icon: ServiceIcon;
  color: ServiceColor;
  benefits: string[];
  active?: boolean;
  price?: string | number | null;
  priceNote?: string;
  duration?: string;
  ctaUrl?: string;
  featured?: boolean;
  category?: string;
};

export type ServicesSectionSettings = {
  badge?: string;
  title?: string;
  subtitle?: string;
  [key: string]: unknown;
};

export type WebsiteMediaSection =
  | 'logo'
  | 'promotions'
  | 'announcements'
  | 'brands'
  | 'gallery'
  | 'team'
  | 'general';

export type WebsiteMediaItem = {
  id: string;
  url: string;
  path: string;
  name: string;
  size?: number;
  section?: WebsiteMediaSection;
  createdAt?: string;
};

export type WebsiteSettings = {
  company_info: CompanyInfo;
  hero_content?: HeroContent;
  hero_stats?: HeroStats;
  offers_section?: OffersSectionSettings;
  promotional_carousel?: PromotionalCarousel;
  offers_carousel?: PromotionalCarousel;
  trust_bar?: TrustBarSettings;
  brands_section?: BrandsSectionSettings;
  booking_section?: BookingSection;
  gallery_section?: GallerySectionSettings;
  announcement?: Announcement;
  announcements?: Announcement[];
  services?: ServiceItem[];
  services_section?: ServicesSectionSettings;
  process_steps?: ProcessStep[];
  process_flows?: ProcessFlow[];
  checkout?: CheckoutSettings;
  maintenance_mode?: { enabled: boolean; title?: string; message?: string; estimatedEnd?: string };
  media_library?: WebsiteMediaItem[];
  [key: string]: unknown;
};

/** Claves que la app puede guardar por `PUT /settings` (la empresa va por sync-company). */
export const EDITABLE_SETTING_KEYS = [
  'hero_content',
  'hero_stats',
  'trust_bar',
  'promotional_carousel',
  'offers_carousel',
  'offers_section',
  'brands_section',
  'booking_section',
  'gallery_section',
  'announcements',
  'announcement',
  'services',
  'services_section',
  'process_steps',
  'process_flows',
  'checkout',
  'maintenance_mode',
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
export function mergeSetting<T extends Record<string, unknown>>(
  current: T | null | undefined,
  patch: Partial<T>,
): T {
  const base: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    base[key] =
      isPlainObject(value) && isPlainObject(base[key])
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
export function buildCompanyPayload(
  saved: CompanyInfo,
  patch: Partial<CompanyInfo>,
  publicationConfirmed = false,
) {
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
  return (
    (next.storefrontPublic === true && saved.storefrontPublic !== true) ||
    (next.marketplacePublic === true &&
      next.storefrontPublic !== false &&
      saved.marketplacePublic !== true)
  );
}

/** Lo mismo que exige el servidor para publicar (src/lib/website/publication.ts). */
export function publicationIssues(company: CompanyInfo, mode: CommerceMode = 'cart'): string[] {
  const issues: string[] = [];
  if (!company.name || company.name.trim().length < 2) {
    issues.push('Completá el nombre comercial.');
  }
  if ((company.phone?.replace(/\D/g, '').length ?? 0) < 6) {
    issues.push('Completá un teléfono de contacto válido.');
  }
  const whatsapp = (company.whatsapp || company.phone || '').replace(/\D/g, '');
  if (mode === 'whatsapp' && whatsapp.length < 6) {
    issues.push('Cargá un WhatsApp válido (por ejemplo 0981 123456) para recibir consultas.');
  }
  return issues;
}

// ─── Validaciones base (espejo de src/lib/validation/website-settings.ts) ───

export function isSafeLinkOrPath(value: string | null | undefined): boolean {
  const target = (value ?? '').trim();
  if (!target) return true;
  if (target.startsWith('//')) return false;
  return target.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(target);
}

export const isValidHexColor = (value: string | null | undefined) =>
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value ?? '');

export const isValidEmail = (value: string | null | undefined) =>
  !value?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';
const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};
export const SOCIAL_BASE: Record<SocialPlatform, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://tiktok.com/@',
};

export function socialHandle(value: string | null | undefined, platform: SocialPlatform): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  let rest = raw.replace(/^https?:\/\//i, '');
  for (const host of SOCIAL_HOSTS[platform]) {
    if (rest.toLowerCase().startsWith(`${host}/`)) {
      rest = rest.slice(host.length + 1);
      break;
    }
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
    return (
      /^(www\.|maps\.)?google\.[a-z.]{2,6}$/.test(host) &&
      (url.pathname.startsWith('/maps') || host.startsWith('maps.'))
    );
  } catch {
    return false;
  }
}

export function isShortMapsLink(value: string | null | undefined): boolean {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps'));
  } catch {
    return false;
  }
}

export function extractMapsCoordinates(value: string | null | undefined): { lat: number; lng: number } | null {
  const text = String(value ?? '');
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

export function slugIssue(value: string): string | null {
  const slug = value.trim();
  if (slug.length < 3) return 'La dirección debe tener al menos 3 caracteres.';
  if (slug.length > 50) return 'La dirección no puede superar 50 caracteres.';
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Usá solo letras minúsculas, números y guiones.';
  return null;
}

export function companyIssues(company: CompanyInfo): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!company.name || company.name.trim().length < 2) {
    issues.name = 'El nombre debe tener al menos 2 caracteres.';
  }
  if (!isValidEmail(company.email)) issues.email = 'Ingresá un email válido.';
  if (company.phone?.trim() && company.phone.replace(/\D/g, '').length < 6) {
    issues.phone = 'El teléfono debe tener al menos 6 dígitos.';
  }
  if (!isValidGoogleMapsUrl(company.mapsUrl)) {
    issues.mapsUrl = 'Ingresá un enlace HTTPS de Google Maps.';
  }
  for (const platform of ['instagram', 'facebook', 'tiktok'] as const) {
    if (!isValidSocial(company[platform], platform)) {
      issues[platform] = 'Ingresá el usuario (@tienda) o el enlace del perfil.';
    }
  }
  if (company.brandColor === 'custom' && !isValidHexColor(company.customBrandColor)) {
    issues.customBrandColor = 'Usá un color HEX, por ejemplo #2563EB.';
  }
  if (company.slug !== undefined && company.slug !== '' && slugIssue(company.slug)) {
    issues.slug = slugIssue(company.slug)!;
  }
  return issues;
}

export function heroIssues(hero: HeroContent): Record<string, string> {
  if (hero.enabled === false) return {};
  const issues: Record<string, string> = {};
  if ((hero.badge ?? '').trim().length < 3) {
    issues.badge = 'La etiqueta debe tener al menos 3 caracteres.';
  }
  if ((hero.title ?? '').trim().length < 10) {
    issues.title = 'El título debe tener al menos 10 caracteres.';
  }
  if ((hero.subtitle ?? '').trim().length < 10) {
    issues.subtitle = 'El subtítulo debe tener al menos 10 caracteres.';
  }
  return issues;
}

const STAT_PATTERN = /^[\p{L}\p{N}\s+\-%.,★☆*/:~<>()]+$/u;

export function heroStatsIssues(stats: HeroStats): Record<string, string> {
  if (stats.enabled !== true || stats.displayMode === 'social') return {};
  const issues: Record<string, string> = {};
  for (const key of ['repairs', 'satisfaction', 'avgTime'] as const) {
    const val = (stats[key] ?? '').trim();
    if (!val) issues[key] = 'Completá la estadística o desactivá el bloque.';
    else if (val.length > 20) issues[key] = 'Máximo 20 caracteres.';
    else if (!STAT_PATTERN.test(val)) issues[key] = 'Usá solo letras, números o signos simples (+, %, ★).';
  }
  return issues;
}

export function slideIssues(slide: CarouselSlide): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!slide.imageUrl || !isSafeLinkOrPath(slide.imageUrl)) {
    issues.imageUrl = 'Elegí una imagen para el banner.';
  }
  if ((slide.imageAlt ?? '').trim().length < 3) {
    issues.imageAlt = 'Describí la imagen (mínimo 3 caracteres).';
  }
  if (!isSafeLinkOrPath(slide.ctaHref)) {
    issues.ctaHref = 'Usá una ruta de tu tienda (/ofertas) o una dirección http(s).';
  }
  if (!slide.hideText && Boolean(slide.ctaText?.trim()) !== Boolean(slide.ctaHref?.trim())) {
    issues.ctaText = 'Completá el texto y el enlace del botón, o dejá ambos vacíos.';
  }
  return issues;
}

export function bookingIssues(booking: Partial<BookingSection>): Record<string, string> {
  const issues: Record<string, string> = {};
  if (booking.enabled !== false) {
    if (!booking.title || booking.title.trim().length < 2) {
      issues.title = 'El título debe tener al menos 2 caracteres.';
    }
    if (booking.title && booking.title.length > 100) {
      issues.title = 'El título no puede superar los 100 caracteres.';
    }
    if (booking.subtitle && booking.subtitle.length > 300) {
      issues.subtitle = 'La descripción no puede superar los 300 caracteres.';
    }
    if (booking.badge && booking.badge.length > 60) {
      issues.badge = 'La etiqueta no puede superar los 60 caracteres.';
    }
  }
  return issues;
}

// ─── Listas ────────────────────────────────────────────────────────────────

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const newSlideId = () => `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function emptySlide(ctaDefaults?: { ctaText?: string; ctaHref?: string }): CarouselSlide {
  return {
    id: newSlideId(),
    title: '',
    message: '',
    imageUrl: '',
    imageAlt: '',
    ctaText: ctaDefaults?.ctaText ?? '',
    ctaHref: ctaDefaults?.ctaHref ?? '',
    active: true,
    contentAlign: 'left',
    textTone: 'light',
    hideText: false,
    badge: '',
    titleSize: 'normal',
    overlayIntensity: 'strong',
    overlayColor: 'black',
    backgroundColor: '',
    titleColor: '',
    fontFamily: 'sans',
  };
}

// ─── Tienda pública ────────────────────────────────────────────────────────

export function publicStoreUrl(siteUrl: string, slug: string | null | undefined): string | null {
  const clean = (slug ?? '').trim();
  if (!clean) return null;
  return `${siteUrl.replace(/\/+$/, '')}/${encodeURIComponent(clean)}`;
}

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
  const images = Array.isArray(raw.images)
    ? (raw.images as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
  const number = (value: unknown) =>
    value === null || value === undefined || value === '' ? null : Number(value);
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

// ─── Apariencia, 13 Plantillas y Colores ───────────────────────────────────

export const BRAND_COLORS: readonly { key: string; name: string; hex: string }[] = [
  { key: 'blue', name: 'Azul', hex: '#3B82F6' },
  { key: 'green', name: 'Verde', hex: '#22C55E' },
  { key: 'purple', name: 'Morado', hex: '#A855F7' },
  { key: 'orange', name: 'Naranja', hex: '#F97316' },
  { key: 'red', name: 'Rojo', hex: '#EF4444' },
  { key: 'indigo', name: 'Índigo', hex: '#6366F1' },
  { key: 'teal', name: 'Teal', hex: '#14B8A6' },
  { key: 'rose', name: 'Rosa', hex: '#F43F5E' },
  { key: 'amber', name: 'Ámbar', hex: '#F59E0B' },
  { key: 'emerald', name: 'Esmeralda', hex: '#10B981' },
  { key: 'cyan', name: 'Cian', hex: '#06B6D4' },
  { key: 'sky', name: 'Cielo', hex: '#0EA5E9' },
];

export const EXTRA_BRAND_COLORS: readonly { hex: string; name: string }[] = [
  { hex: '#8B1E3F', name: 'Bordó' },
  { hex: '#6B1D2F', name: 'Vino' },
  { hex: '#C8473D', name: 'Coral' },
  { hex: '#B4532A', name: 'Terracota' },
  { hex: '#9A6A0B', name: 'Mostaza' },
  { hex: '#8A6D1E', name: 'Dorado' },
  { hex: '#556B2F', name: 'Oliva' },
  { hex: '#166534', name: 'Verde bosque' },
  { hex: '#047857', name: 'Jade' },
  { hex: '#0F5E6E', name: 'Petróleo' },
  { hex: '#3B5B85', name: 'Azul acero' },
  { hex: '#1E3A8A', name: 'Azul marino' },
  { hex: '#7457B8', name: 'Lavanda' },
  { hex: '#6D28D9', name: 'Violeta' },
  { hex: '#7E2A6E', name: 'Ciruela' },
  { hex: '#B21FB8', name: 'Fucsia' },
  { hex: '#6B3E26', name: 'Chocolate' },
  { hex: '#475569', name: 'Pizarra' },
  { hex: '#374151', name: 'Grafito' },
  { hex: '#111827', name: 'Negro' },
];

export function findExtraBrandColor(hex?: string | null): { hex: string; name: string } | null {
  if (!hex) return null;
  const normalized = hex.trim().toUpperCase();
  return EXTRA_BRAND_COLORS.find((color) => color.hex === normalized) ?? null;
}

export function brandHex(company: Pick<CompanyInfo, 'brandColor' | 'customBrandColor'>): string {
  if (company.brandColor === 'custom' && isValidHexColor(company.customBrandColor)) {
    return company.customBrandColor!;
  }
  return BRAND_COLORS.find((color) => color.key === company.brandColor)?.hex ?? BRAND_COLORS[0].hex;
}

export const STOREFRONT_STYLE_PREFERENCES = [
  'auto',
  'classic',
  'fashion',
  'sport',
  'tech',
  'market',
  'modern',
  'services',
  'beauty',
  'wholesale-pro',
  'catalog-basic',
  'informatica-electronica',
  'barber',
] as const;

export type StorefrontStylePreference = (typeof STOREFRONT_STYLE_PREFERENCES)[number];
export type StorefrontStyle = Exclude<StorefrontStylePreference, 'auto'>;

export const STOREFRONT_STYLES: readonly { value: StorefrontStylePreference; label: string; description: string }[] = [
  { value: 'auto', label: 'Automático', description: 'Se elige según el rubro de tu negocio.' },
  { value: 'classic', label: 'Tienda Clásica', description: 'Foto completa en tarjetas apaisadas. Para tecnología, ferretería o almacén.' },
  { value: 'fashion', label: 'Boutique de Moda', description: 'Fotos verticales a sangre, títulos elegantes y categorías con foto.' },
  { value: 'sport', label: 'Deportes & Zapatillas', description: 'Fotos verticales, títulos grandes en mayúsculas y más contraste.' },
  { value: 'tech', label: 'Celulares & Gadgets', description: 'Diseño enfocado en dispositivos, ficha técnica, gadgets y servicios técnicos.' },
  { value: 'informatica-electronica', label: 'Mega Tienda Tech', description: 'Compra por marca y por categoría, ofertas reales y diseño neutro adaptable.' },
  { value: 'market', label: 'Supermercado & Almacén', description: 'Pasillos, descuentos por porcentaje y compra rápida con cantidades.' },
  { value: 'wholesale-pro', label: 'Mayorista & Distribuidora', description: 'Catálogo moderno para ventas minoristas y mayoristas con muchos productos.' },
  { value: 'modern', label: 'Estudio Minimalista', description: 'Estilo contemporáneo con bordes suaves redondeados y atmósfera limpia.' },
  { value: 'services', label: 'Turnos & Servicios', description: 'Peluquerías, barberías y estética: servicios con precio y turnos al frente.' },
  { value: 'barber', label: 'Barbería Club', description: 'Carta de rituales, maestros barberos y reserva de turnos online.' },
  { value: 'beauty', label: 'Cosmética & Perfumería', description: 'Compra por necesidad (rostro, cabello, maquillaje), marcas y rutinas.' },
  { value: 'catalog-basic', label: 'Vitrina sin Carrito', description: 'Vitrina simple para exhibir productos con foto y precio, sin carrito.' },
];

export type TemplateVariant = {
  id: string;
  name: string;
  tagline: string;
  badgeText: string;
};

export type StorefrontTemplateMeta = {
  id: StorefrontStyle;
  name: string;
  badge: string;
  tagline: string;
  recommendedColors: string[];
  features: string[];
  accentHex: string;
  variants: TemplateVariant[];
};

export const STOREFRONT_TEMPLATES_META: Record<StorefrontStyle, StorefrontTemplateMeta> = {
  classic: {
    id: 'classic',
    name: 'Tienda Clásica',
    badge: 'Equilibrado',
    tagline: 'Foto completa 4:3, estadísticas y cabecera formal',
    recommendedColors: ['blue', 'indigo', 'emerald'],
    features: ['Fotos completas 4:3', 'Estadísticas de confianza', 'Cabecera con buscador'],
    accentHex: '#2563EB',
    variants: [
      { id: 'classic-standard', name: 'Estándar Universal', tagline: 'Distribución equilibrada', badgeText: 'Recomendado' },
      { id: 'classic-technical', name: 'Catálogo Industrial', tagline: 'Foco en SKU y stock', badgeText: 'Técnico' },
      { id: 'classic-commercial', name: 'Comercial Directo', tagline: 'Atención rápida WhatsApp', badgeText: 'Directo' },
    ],
  },
  fashion: {
    id: 'fashion',
    name: 'Boutique de Moda',
    badge: 'Visual & Elegante',
    tagline: 'Fotos verticales 3:4 y lookbook editorial',
    recommendedColors: ['rose', 'amber', 'purple'],
    features: ['Fotos verticales 3:4', 'Tipografía editorial', 'Colecciones visuales'],
    accentHex: '#F43F5E',
    variants: [
      { id: 'fashion-lookbook', name: 'Editorial Lookbook', tagline: 'Pasarela serif limpia', badgeText: 'Editorial' },
      { id: 'fashion-luxury', name: 'Haute Couture / Lujo', tagline: 'Atmósfera oscura sobria', badgeText: 'Lujo' },
      { id: 'fashion-streetwear', name: 'Streetwear Urbano', tagline: 'Tipografía bold moderna', badgeText: 'Urbano' },
    ],
  },
  sport: {
    id: 'sport',
    name: 'Deportes & Zapatillas',
    badge: 'Dinámico & Bold',
    tagline: 'Alto contraste, títulos inclinados y drops',
    recommendedColors: ['red', 'orange', 'emerald'],
    features: ['Badges angulares', 'Tipografía deportiva', 'Alto contraste'],
    accentHex: '#F97316',
    variants: [
      { id: 'sport-pro', name: 'High Performance Pro', tagline: 'Alto impacto enérgico', badgeText: 'Pro' },
      { id: 'sport-fitness', name: 'Fitness & Wellness', tagline: 'Look fresco y limpio', badgeText: 'Fitness' },
      { id: 'sport-sneakers', name: 'Sneakers & Drops', tagline: 'Lanzamientos y calzados', badgeText: 'Drops' },
    ],
  },
  tech: {
    id: 'tech',
    name: 'Celulares & Gadgets',
    badge: 'Innovación',
    tagline: 'Especificaciones, modelos y soporte técnico',
    recommendedColors: ['cyan', 'sky', 'indigo', 'blue'],
    features: ['Badges técnicos mono', 'Compatibilidad', 'Foco en garantía'],
    accentHex: '#06B6D4',
    variants: [
      { id: 'tech-cyber', name: 'Dark Cyberpunk', tagline: 'Micro-brillos cian y oscuro', badgeText: 'Cyber' },
      { id: 'tech-clean', name: 'Studio Minimal Tech', tagline: 'Blanco pulcro minimalista', badgeText: 'Minimal' },
      { id: 'tech-repair', name: 'Servicio Técnico Oficial', tagline: 'Foco en taller y repuestos', badgeText: 'Taller' },
    ],
  },
  'informatica-electronica': {
    id: 'informatica-electronica',
    name: 'Mega Tienda Tech',
    badge: 'Tech & Informática',
    tagline: 'Compra por marca, categorías con íconos y % OFF',
    recommendedColors: ['blue', 'indigo', 'cyan', 'emerald'],
    features: ['Header técnico con buscador', 'Compra por marca', 'Ofertas % OFF real'],
    accentHex: '#1E293B',
    variants: [],
  },
  market: {
    id: 'market',
    name: 'Supermercado & Almacén',
    badge: 'Alta Conversión',
    tagline: 'Precios protagonistas y suma rápida al carrito',
    recommendedColors: ['emerald', 'amber', 'green'],
    features: ['Precios grandes', 'Descuentos a la vista', 'Suma directa en tarjetas'],
    accentHex: '#10B981',
    variants: [
      { id: 'market-wholesale', name: 'Mayorista & Ahorro', tagline: 'Insignias 2x1 y bultos', badgeText: 'Mayorista' },
      { id: 'market-express', name: 'Compra Ágil Express', tagline: 'Botón + rápido directo', badgeText: 'Express' },
      { id: 'market-bazar', name: 'Retail & Bazar', tagline: 'Departamentos nítidos', badgeText: 'Bazar' },
    ],
  },
  'wholesale-pro': {
    id: 'wholesale-pro',
    name: 'Mayorista & Distribuidora',
    badge: 'Catálogo profesional',
    tagline: 'Ideal para muchos productos y compradores frecuentes',
    recommendedColors: ['blue', 'indigo', 'teal'],
    features: ['Buscador protagonista', 'Categorías accesibles', 'Precios según tu cuenta'],
    accentHex: '#334155',
    variants: [],
  },
  modern: {
    id: 'modern',
    name: 'Estudio Minimalista',
    badge: 'Contemporáneo',
    tagline: 'Curvas suaves, sombras delicadas y limpieza visual',
    recommendedColors: ['teal', 'purple', 'rose'],
    features: ['Bordes suaves rounded-2xl', 'Composición limpia', 'Paletas sobrias'],
    accentHex: '#8B5CF6',
    variants: [
      { id: 'modern-organic', name: 'Studio Orgánico', tagline: 'Curvas ultra-suaves', badgeText: 'Orgánico' },
      { id: 'modern-glass', name: 'Glassmorphism Cristal', tagline: 'Capas translúcidas', badgeText: 'Glass' },
      { id: 'modern-editorial', name: 'Vanguardia Tipográfica', tagline: 'Espacios en blanco puros', badgeText: 'Vanguardia' },
    ],
  },
  services: {
    id: 'services',
    name: 'Turnos & Servicios',
    badge: 'Reservas online',
    tagline: 'Carta de servicios con precio, duración y reserva al frente',
    recommendedColors: ['rose', 'amber', 'teal'],
    features: ['Botón Reservar siempre a mano', 'Carta de servicios', 'Equipo y horarios'],
    accentHex: '#EC4899',
    variants: [],
  },
  barber: {
    id: 'barber',
    name: 'Barbería Club',
    badge: 'Club de Caballeros',
    tagline: 'Rituales, maestros barberos y reserva online',
    recommendedColors: ['amber', 'orange', 'teal', 'indigo'],
    features: ['Carta de rituales', 'Agenda integrada', 'Boutique grooming'],
    accentHex: '#D97706',
    variants: [
      { id: 'barber-club', name: 'Gentlemen Club', tagline: 'Clásico club vintage', badgeText: 'Club' },
      { id: 'barber-modern', name: 'Barber Modern Fade', tagline: 'Cortes urbanos y fades', badgeText: 'Modern' },
    ],
  },
  beauty: {
    id: 'beauty',
    name: 'Cosmética & Perfumería',
    badge: 'Suave & Cuidado',
    tagline: 'Categorías en círculos, marcas y rutinas diarias',
    recommendedColors: ['rose', 'purple', 'amber'],
    features: ['Círculos por necesidad', 'Rutinas de cuidado', 'Sellos de confianza'],
    accentHex: '#F472B6',
    variants: [],
  },
  'catalog-basic': {
    id: 'catalog-basic',
    name: 'Vitrina sin Carrito',
    badge: 'Vitrina simple',
    tagline: 'Exhibición rápida con foto y precio, sin botones de compra',
    recommendedColors: ['blue', 'emerald', 'indigo', 'teal'],
    features: ['Sin carrito', 'Carga rápida', 'Ideal para mostrador'],
    accentHex: '#475569',
    variants: [],
  },
};

export type StorefrontTemplateGroupId = 'auto' | 'general' | 'tech' | 'fashion' | 'beauty' | 'food';

export type StorefrontTemplateGroup = {
  id: StorefrontTemplateGroupId;
  title: string;
  label: string;
  badge: string;
  templateKeys: readonly StorefrontStylePreference[];
};

export const STOREFRONT_TEMPLATE_GROUPS: readonly StorefrontTemplateGroup[] = [
  { id: 'auto', title: 'Selección automática', label: 'Automático', badge: 'Según tu rubro', templateKeys: ['auto'] },
  { id: 'general', title: 'Comercio general', label: 'Comercio', badge: 'Multirrubro', templateKeys: ['classic', 'modern', 'catalog-basic'] },
  { id: 'tech', title: 'Tecnología & Electrónica', label: 'Tecnología', badge: 'Celulares, PC y gadgets', templateKeys: ['tech', 'informatica-electronica'] },
  { id: 'fashion', title: 'Moda & Deportes', label: 'Moda', badge: 'Ropa y calzado', templateKeys: ['fashion', 'sport'] },
  { id: 'beauty', title: 'Belleza & Estética', label: 'Belleza', badge: 'Productos y turnos', templateKeys: ['beauty', 'services', 'barber'] },
  { id: 'food', title: 'Almacén & Mayoristas', label: 'Almacén', badge: 'Alto volumen', templateKeys: ['market', 'wholesale-pro'] },
];

export const STOREFRONT_TEMPLATE_TIER: Record<StorefrontStylePreference, 'base' | 'rubro' | 'premium'> = {
  auto: 'base',
  classic: 'base',
  'catalog-basic': 'base',
  modern: 'base',
  fashion: 'rubro',
  sport: 'rubro',
  tech: 'rubro',
  market: 'rubro',
  beauty: 'rubro',
  services: 'rubro',
  'informatica-electronica': 'premium',
  'wholesale-pro': 'premium',
  barber: 'premium',
};

export const TEMPLATE_TIER_LABEL: Record<'base' | 'rubro' | 'premium', string> = {
  base: 'Esencial',
  rubro: 'De rubro',
  premium: 'Premium',
};

export const SERVICE_WEBSITE_VARIANTS: readonly ServiceWebsiteVariant[] = ['barber', 'salon', 'studio', 'professional'];

export const SERVICE_VARIANT_PRESETS: Record<
  ServiceWebsiteVariant,
  { label: string; color: string; title: string; subtitle: string }
> = {
  barber: { label: 'Barbería', color: '#334155', title: 'Tu estilo, tu espacio', subtitle: 'Conocé nuestros servicios de barbería y coordiná tu atención.' },
  salon: { label: 'Salón de belleza', color: '#885F44', title: 'Un espacio para tu cabello', subtitle: 'Conocé los servicios de peluquería y cuidado que ofrecemos.' },
  studio: { label: 'Estudio de belleza', color: '#826078', title: 'Un momento para cuidarte', subtitle: 'Descubrí nuestros servicios de belleza y cuidado personal.' },
  professional: { label: 'Servicios profesionales', color: '#245E58', title: 'Encontrá el servicio que necesitás', subtitle: 'Conocé nuestras opciones y coordiná tu atención.' },
};

export const SERVICE_SPECIALTIES_LIST: readonly ServiceSpecialty[] = [
  'barbering',
  'hair',
  'nails',
  'lashes',
  'brows',
  'makeup',
  'aesthetics',
  'other',
];

export const SERVICE_SPECIALTY_LABELS: Record<ServiceSpecialty, string> = {
  barbering: 'Barbería',
  hair: 'Peluquería',
  nails: 'Uñas',
  lashes: 'Pestañas',
  brows: 'Cejas',
  makeup: 'Maquillaje',
  aesthetics: 'Estética',
  other: 'Otros servicios',
};

const SERVICE_VERTICALS = new Set<string>(['barbershop', 'beauty_services']);
const PRODUCT_VERTICALS = new Set<string>(['clothing', 'electronics', 'food', 'hardware']);
const STORE_STYLES_FOR_SERVICE_VERTICAL: Record<string, readonly StorefrontStyle[]> = {
  barbershop: ['classic', 'modern'],
  beauty_services: ['classic', 'modern', 'beauty'],
};
const STYLE_BY_VERTICAL: Record<BusinessVertical, StorefrontStyle> = {
  general: 'classic',
  clothing: 'fashion',
  cosmetics: 'beauty',
  electronics: 'tech',
  food: 'market',
  hardware: 'classic',
  barbershop: 'services',
  beauty_services: 'services',
  other: 'classic',
};

export type StorefrontStyleContext = {
  servicesAvailable?: boolean;
  catalogAvailable?: boolean;
  businessVertical?: unknown;
  commerceMode?: CommerceMode;
};

export function isStorefrontStyleAvailable(
  style: StorefrontStylePreference,
  context: StorefrontStyleContext = {},
): boolean {
  if (style === 'auto' || style === 'wholesale-pro') return true;
  if (style === 'catalog-basic') return context.commerceMode === 'catalog';
  const vertical = typeof context.businessVertical === 'string' ? context.businessVertical : '';
  if (style === 'services' || style === 'barber') {
    return context.servicesAvailable !== false && !PRODUCT_VERTICALS.has(vertical);
  }
  if (SERVICE_VERTICALS.has(vertical)) {
    return (
      context.catalogAvailable !== false &&
      (STORE_STYLES_FOR_SERVICE_VERTICAL[vertical] ?? []).includes(style)
    );
  }
  return true;
}

export function resolveStorefrontStyle(
  preference: unknown,
  businessVertical: unknown,
  context: StorefrontStyleContext = {},
): StorefrontStyle {
  const mergedCtx = { businessVertical, ...context };
  const validVertical =
    typeof businessVertical === 'string' &&
    Object.prototype.hasOwnProperty.call(STYLE_BY_VERTICAL, businessVertical)
      ? (businessVertical as BusinessVertical)
      : undefined;
  const byVertical = validVertical ? STYLE_BY_VERTICAL[validVertical] : 'classic';
  const isExplicit =
    typeof preference === 'string' &&
    preference !== 'auto' &&
    (STOREFRONT_STYLE_PREFERENCES as readonly string[]).includes(preference);
  const chosen: StorefrontStyle = isExplicit ? (preference as StorefrontStyle) : byVertical;
  if (!isStorefrontStyleAvailable(chosen, mergedCtx)) {
    const order: StorefrontStyle[] = SERVICE_VERTICALS.has(String(businessVertical))
      ? ['modern', 'classic']
      : ['classic', 'modern'];
    const fallback = [byVertical, ...order].find(
      (style) => style !== chosen && isStorefrontStyleAvailable(style, mergedCtx),
    );
    return fallback ?? 'modern';
  }
  return chosen;
}

export type PlanTemplateSummary = {
  code: PlanCode;
  name: string;
  templates: StorefrontStylePreference[];
};

export type TemplateAccessData = {
  planCode: PlanCode;
  planName: string;
  allowed: StorefrontStylePreference[];
  businessVertical: string;
  servicesAvailable: boolean;
  operatingModel?: OperatingModel;
  effectiveModules?: OrganizationModule[];
  serviceSpecialties?: (ServiceSpecialty | (string & {}))[];
  plans: PlanTemplateSummary[];
};

const PLAN_CODE_ORDER: readonly PlanCode[] = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

export function isTemplateInPlan(
  style: StorefrontStylePreference,
  allowed: readonly StorefrontStylePreference[],
  businessVertical?: unknown,
  context: StorefrontStyleContext = {},
): boolean {
  if (style === 'auto' && !allowed.includes('auto')) return false;
  const resolved = style === 'auto' ? resolveStorefrontStyle('auto', businessVertical, context) : style;
  return allowed.includes(resolved);
}

export function cheapestPlanWithTemplate(
  style: StorefrontStylePreference,
  plans: readonly PlanTemplateSummary[],
  businessVertical?: unknown,
  context: StorefrontStyleContext = {},
): PlanTemplateSummary | null {
  const ordered = [...plans].sort(
    (a, b) => PLAN_CODE_ORDER.indexOf(a.code) - PLAN_CODE_ORDER.indexOf(b.code),
  );
  return ordered.find((plan) => isTemplateInPlan(style, plan.templates, businessVertical, context)) ?? null;
}

export type TemplateStatus = 'available' | 'locked_plan' | 'unavailable';

export type TemplateCatalogOption = {
  value: StorefrontStylePreference;
  label: string;
  subtitle: string;
  description: string;
  resolvedStyle: StorefrontStyle;
  tier: 'base' | 'rubro' | 'premium';
  status: TemplateStatus;
  reason?: string;
  upgradePlanName?: string;
  isSuggested: boolean;
  isRecommended: boolean;
};

export type TemplateCatalogGroup = StorefrontTemplateGroup & {
  options: TemplateCatalogOption[];
  availableCount: number;
};

const GROUP_BY_VERTICAL: Record<string, StorefrontTemplateGroupId> = {
  electronics: 'tech',
  clothing: 'fashion',
  cosmetics: 'beauty',
  barbershop: 'beauty',
  beauty_services: 'beauty',
  food: 'food',
  hardware: 'general',
  general: 'general',
  other: 'general',
};

function unavailableTemplateReason(
  style: StorefrontStylePreference,
  context: StorefrontStyleContext,
): string {
  if (style === 'catalog-basic') {
    return 'Solo con la forma de venta «Catálogo» (sin carrito ni pedidos).';
  }
  if (style === 'services' || style === 'barber') {
    return context.servicesAvailable === false
      ? 'Necesita la agenda de turnos (módulo Servicios).'
      : 'Pensada para negocios de turnos, no para tu rubro.';
  }
  if (context.catalogAvailable === false) return 'Tu negocio no vende productos.';
  return 'No encaja con el rubro de tu negocio.';
}

export function buildMobileTemplateCatalog(input: {
  businessVertical?: string | null;
  context: StorefrontStyleContext;
  savedValue?: StorefrontStylePreference;
  suggestedStyle?: StorefrontStylePreference;
  access?: Pick<TemplateAccessData, 'planName' | 'allowed' | 'plans'> | null;
}): TemplateCatalogGroup[] {
  const { businessVertical, savedValue, suggestedStyle, access } = input;
  const context = { businessVertical, ...input.context };
  const ownGroup = GROUP_BY_VERTICAL[String(businessVertical ?? '')] ?? 'general';
  const TIER_ORDER = { base: 0, rubro: 1, premium: 2 } as const;
  const STATUS_ORDER = { available: 0, locked_plan: 1, unavailable: 2 } as const;

  const groups = STOREFRONT_TEMPLATE_GROUPS.map((group) => {
    const options = group.templateKeys.flatMap((key): TemplateCatalogOption[] => {
      const option = STOREFRONT_STYLES.find((item) => item.value === key);
      if (!option) return [];
      const resolvedStyle = resolveStorefrontStyle(key, businessVertical, context);
      const fitsBusiness = isStorefrontStyleAvailable(key, context);
      const inPlan =
        !access ||
        key === savedValue ||
        isTemplateInPlan(key, access.allowed, businessVertical, context);
      const status: TemplateStatus = !fitsBusiness
        ? 'unavailable'
        : inPlan
          ? 'available'
          : 'locked_plan';
      const upgradePlan =
        status === 'locked_plan' && access
          ? cheapestPlanWithTemplate(key, access.plans, businessVertical, context)
          : null;
      return [
        {
          value: key,
          label: key === 'auto' ? 'Automático' : option.label,
          subtitle:
            key === 'auto'
              ? `Según tu rubro: ${STOREFRONT_TEMPLATES_META[resolvedStyle].name}`
              : STOREFRONT_TEMPLATES_META[resolvedStyle].badge,
          description: option.description,
          resolvedStyle,
          tier: STOREFRONT_TEMPLATE_TIER[key],
          status,
          reason:
            status === 'unavailable'
              ? unavailableTemplateReason(key, context)
              : status === 'locked_plan'
                ? upgradePlan
                  ? `Disponible en el plan ${upgradePlan.name}.`
                  : `No está incluida en tu plan ${access?.planName ?? ''}.`.replace(' .', '.')
                : undefined,
          upgradePlanName: upgradePlan?.name,
          isSuggested: key === suggestedStyle,
          isRecommended: context.commerceMode === 'catalog' && key === 'catalog-basic',
        },
      ];
    });

    options.sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        Number(b.isSuggested || b.isRecommended) - Number(a.isSuggested || a.isRecommended) ||
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier],
    );

    return {
      ...group,
      options,
      availableCount: options.filter((o) => o.status === 'available').length,
    };
  });

  return groups.sort((a, b) => {
    const rank = (g: TemplateCatalogGroup) => (g.id === 'auto' ? 0 : g.id === ownGroup ? 1 : 2);
    return rank(a) - rank(b);
  });
}

export type StorefrontAppearanceSuggestion = {
  style: StorefrontStyle;
  brandColor: string;
  headerStyle: 'solid' | 'accent' | 'dark';
  reason: string;
};

const VERTICAL_NAMES: Record<BusinessVertical, string> = {
  general: 'comercio general',
  clothing: 'indumentaria',
  barbershop: 'barbería y peluquería',
  beauty_services: 'belleza y cuidado personal',
  cosmetics: 'cosmética',
  electronics: 'tecnología',
  food: 'alimentos',
  hardware: 'ferretería',
  other: 'otro rubro',
};

const STYLE_BY_VERTICAL_SUGGESTION: Record<BusinessVertical, StorefrontStyle | null> = {
  general: null,
  other: null,
  clothing: 'fashion',
  barbershop: 'services',
  beauty_services: 'services',
  cosmetics: 'beauty',
  electronics: 'tech',
  food: 'market',
  hardware: 'classic',
};

const HEADER_BY_STYLE: Record<StorefrontStyle, 'solid' | 'accent' | 'dark'> = {
  'wholesale-pro': 'solid',
  'catalog-basic': 'solid',
  'informatica-electronica': 'accent',
  classic: 'solid',
  fashion: 'solid',
  sport: 'dark',
  tech: 'dark',
  market: 'accent',
  modern: 'solid',
  services: 'dark',
  beauty: 'solid',
  barber: 'dark',
};

export function suggestStorefrontAppearance(input: {
  businessVertical?: unknown;
  name?: string;
  slogan?: string;
  description?: string;
  servicesAvailable?: boolean;
  catalogAvailable?: boolean;
  commerceMode?: CommerceMode;
}): StorefrontAppearanceSuggestion {
  const vertical: BusinessVertical =
    typeof input.businessVertical === 'string' && input.businessVertical in VERTICAL_NAMES
      ? (input.businessVertical as BusinessVertical)
      : 'general';
  const text = [input.name, input.slogan, input.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const keywordRules: { style: StorefrontStyle; pattern: RegExp }[] = [
    { style: 'barber', pattern: /(varsovia|club de caballeros|afeitad\w* a navaja|toallas? calientes?)/i },
    { style: 'informatica-electronica', pattern: /(inform[aá]tica|computaci[oó]n|hardware|perif[eé]ricos|componentes pc)/i },
    { style: 'services', pattern: /(peluquer|barber|sal[oó]n de belleza|u[nñ]as|manicur|pedicur|spa|masajes|est[eé]tica|pesta[nñ]as|cejas)/i },
    { style: 'sport', pattern: /(deport|fitness|gym|gimnasio|suplementos|zapatillas|sneakers|running)/i },
    { style: 'fashion', pattern: /(ropa|moda|boutique|indumentaria|calzados|lencer|joyer|carteras)/i },
    { style: 'tech', pattern: /(celular|tel[eé]fonos|smartphones|tecnolog|gamer|gaming|electr[oó]nic|servicio t[eé]cnico)/i },
    { style: 'market', pattern: /(supermercado|almac[eé]n|despensa|minimarket|bebidas|mayorista|bazar|autoservicio)/i },
    { style: 'beauty', pattern: /(cosm[eé]tic|maquillaje|skincare|perfumer|fragancias|belleza)/i },
    { style: 'modern', pattern: /([oó]ptica|decoraci[oó]n|librer[ií]a|caf[eé]|florer[ií]a)/i },
  ];

  const keywordHit = keywordRules
    .map(({ style, pattern }) => ({ style, match: text.match(pattern)?.[0] }))
    .find((hit) => hit.match);

  let style: StorefrontStyle;
  let reason: string;
  const byVertical = STYLE_BY_VERTICAL_SUGGESTION[vertical];
  if (input.commerceMode === 'catalog') {
    style = 'catalog-basic';
    reason = 'Con la modalidad Solo catálogo digital, esta vitrina simple es la más adecuada.';
  } else if (byVertical) {
    style = byVertical;
    reason = `Tu rubro es ${VERTICAL_NAMES[vertical]}.`;
  } else if (keywordHit) {
    style = keywordHit.style;
    reason = `Tu negocio menciona «${keywordHit.match}».`;
  } else {
    style = 'classic';
    reason = 'Es la plantilla más versátil para catálogos variados.';
  }

  const context: StorefrontStyleContext = {
    servicesAvailable: input.servicesAvailable,
    catalogAvailable: input.catalogAvailable,
    businessVertical: vertical,
    commerceMode: input.commerceMode,
  };
  if (!isStorefrontStyleAvailable(style, context)) {
    style = resolveStorefrontStyle(style, vertical, context);
    reason = `Es la que mejor encaja con ${VERTICAL_NAMES[vertical]}.`;
  }

  return {
    style,
    brandColor: STOREFRONT_TEMPLATES_META[style].recommendedColors[0] ?? 'blue',
    headerStyle: HEADER_BY_STYLE[style],
    reason,
  };
}

export const HEADER_STYLES: readonly { value: 'solid' | 'accent' | 'dark'; label: string; description: string }[] = [
  { value: 'solid', label: 'Claro', description: 'Fondo blanco. Funciona con cualquier logo.' },
  { value: 'accent', label: 'Color de marca', description: 'Fondo con tu color. Ideal con logo blanco.' },
  { value: 'dark', label: 'Oscuro', description: 'Fondo negro, contraste premium.' },
];

// ─── Capacidades, Disponibilidad, Checklist guiado ─────────────────────────

export type MobileStorefrontCapabilities = {
  businessVertical: BusinessVertical;
  operatingModel: OperatingModel;
  businessLabel: string;
  hasCatalog: boolean;
  hasServices: boolean;
  hasRepairs: boolean;
  hasOrderTracking: boolean;
  hasDeliveryModule: boolean;
  serviceSpecialties: (ServiceSpecialty | (string & {}))[];
  metricLabels: [string, string, string];
  primaryAction: { kind: 'products' | 'services'; href: '/productos' | '/servicios' };
  tracking: { kind: 'repairs' | 'orders' | 'none'; href: '/mis-reparaciones' | '/track' | null };
};

const BUSINESS_LABELS: Record<BusinessVertical, string> = {
  general: 'Comercio general',
  clothing: 'Moda e indumentaria',
  barbershop: 'Barbería y peluquería',
  beauty_services: 'Belleza y cuidado personal',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Tecnología y electrónica',
  food: 'Alimentos y gastronomía',
  hardware: 'Ferretería y herramientas',
  other: 'Otro rubro',
};

export function resolveMobileCapabilities(input: {
  templateAccess?: TemplateAccessData | null;
  panelKeys?: readonly string[];
  panelFocus?: 'repairs' | 'agenda' | null;
  company?: CompanyInfo;
}): MobileStorefrontCapabilities {
  const rawVertical = input.templateAccess?.businessVertical;
  const businessVertical: BusinessVertical =
    typeof rawVertical === 'string' && rawVertical in BUSINESS_LABELS
      ? (rawVertical as BusinessVertical)
      : input.panelFocus === 'agenda'
        ? 'barbershop'
        : input.panelFocus === 'repairs'
          ? 'electronics'
          : 'general';

  const modules = new Set<string>(input.templateAccess?.effectiveModules ?? []);
  const keys = new Set<string>(input.panelKeys ?? []);

  const hasModules = modules.size > 0;
  const hasCatalog = hasModules ? modules.has('inventory') : keys.size === 0 || keys.has('products');
  const hasServices = hasModules
    ? modules.has('services')
    : input.templateAccess?.servicesAvailable ?? (input.panelFocus === 'agenda' || keys.has('agenda'));
  const hasRepairs = hasModules
    ? modules.has('repairs')
    : input.panelFocus === 'repairs' || keys.has('repairs');
  const hasOrderTracking = hasModules
    ? modules.has('orders') || modules.has('delivery')
    : keys.size === 0 || keys.has('orders');
  const hasDeliveryModule = hasModules ? modules.has('delivery') || modules.has('orders') : true;

  const operatingModel: OperatingModel =
    input.templateAccess?.operatingModel ??
    (hasRepairs ? (hasCatalog ? 'mixed' : 'repair') : hasServices && !hasCatalog ? 'service' : 'retail');

  const serviceFirst =
    hasServices &&
    !modules.has('ecommerce') &&
    (operatingModel === 'service' || operatingModel === 'repair');

  const metricLabels: [string, string, string] = hasRepairs
    ? ['Reparaciones', 'Satisfacción', 'Tiempo prom.']
    : hasServices && operatingModel === 'service'
      ? ['Servicios', 'Satisfacción', 'Respuesta']
      : ['Clientes', 'Valoración', 'Entrega'];

  return {
    businessVertical,
    operatingModel,
    businessLabel: BUSINESS_LABELS[businessVertical],
    hasCatalog,
    hasServices,
    hasRepairs,
    hasOrderTracking,
    hasDeliveryModule,
    serviceSpecialties: input.templateAccess?.serviceSpecialties ?? input.company?.serviceSpecialties ?? [],
    metricLabels,
    primaryAction: serviceFirst
      ? { kind: 'services', href: '/servicios' }
      : { kind: 'products', href: '/productos' },
    tracking: hasRepairs
      ? { kind: 'repairs', href: '/mis-reparaciones' }
      : hasOrderTracking
        ? { kind: 'orders', href: '/track' }
        : { kind: 'none', href: null },
  };
}

export type WebsiteSectionId =
  | 'company'
  | 'appearance'
  | 'checkout'
  | 'hero'
  | 'trust_bar'
  | 'brands'
  | 'carousel'
  | 'offers'
  | 'announcement'
  | 'booking'
  | 'gallery'
  | 'services'
  | 'process';

export type SectionAvailability = {
  available: boolean;
  requires?: string;
};

export function resolveMobileSectionAvailability(
  capabilities: Pick<MobileStorefrontCapabilities, 'hasCatalog' | 'hasServices' | 'hasRepairs'>,
): Record<WebsiteSectionId, SectionAvailability> {
  const needs = (ok: boolean, requires: string): SectionAvailability =>
    ok ? { available: true } : { available: false, requires };
  const serviceLike = capabilities.hasServices || capabilities.hasRepairs;
  const CATALOG = 'el catálogo de productos (Inventario, Pedidos o Tienda online)';
  const SERVICES = 'el módulo Servicios (agenda de turnos)';
  const SERVICES_OR_REPAIRS = 'el módulo Servicios o Reparaciones';
  return {
    company: { available: true },
    appearance: { available: true },
    hero: { available: true },
    trust_bar: { available: true },
    carousel: { available: true },
    announcement: { available: true },
    process: { available: true },
    checkout: needs(capabilities.hasCatalog, CATALOG),
    brands: needs(capabilities.hasCatalog, CATALOG),
    offers: needs(capabilities.hasCatalog, CATALOG),
    booking: needs(capabilities.hasServices, SERVICES),
    services: needs(serviceLike, SERVICES_OR_REPAIRS),
    gallery: needs(serviceLike, SERVICES_OR_REPAIRS),
  };
}

export type WebsiteFocus = 'services' | 'repairs' | 'retail';

export function resolveWebsiteFocus(
  capabilities: Pick<MobileStorefrontCapabilities, 'businessVertical' | 'operatingModel' | 'hasServices' | 'hasRepairs'>,
): WebsiteFocus {
  if (capabilities.businessVertical === 'barbershop') return 'services';
  if (capabilities.operatingModel === 'service' && capabilities.hasServices) return 'services';
  if (capabilities.hasRepairs || capabilities.operatingModel === 'repair') return 'repairs';
  return 'retail';
}

export type GuidanceFamily = BusinessVertical | 'repairs';

export function guidanceFamily(
  capabilities: Pick<MobileStorefrontCapabilities, 'businessVertical' | 'hasRepairs'>,
): GuidanceFamily {
  return capabilities.hasRepairs ? 'repairs' : capabilities.businessVertical;
}

export type MobileChecklistStep = {
  id: string;
  section: WebsiteSectionId;
  route: string;
  title: string;
  why: string;
  done: boolean;
  missing?: string;
  cta: string;
};

export type MobileSetupChecklist = {
  focus: WebsiteFocus;
  essentials: MobileChecklistStep[];
  recommended: MobileChecklistStep[];
  done: number;
  total: number;
  next: MobileChecklistStep | null;
};

const ROUTE_BY_SECTION: Record<WebsiteSectionId, string> = {
  company: '/admin/website/business',
  appearance: '/admin/website/appearance',
  checkout: '/admin/website/checkout',
  hero: '/admin/website/home',
  trust_bar: '/admin/website/benefits',
  brands: '/admin/website/brands',
  carousel: '/admin/website/banners',
  offers: '/admin/website/offers',
  announcement: '/admin/website/announcements',
  booking: '/admin/website/booking',
  gallery: '/admin/website/gallery',
  services: '/admin/website/services',
  process: '/admin/website/process',
};

export function buildMobileWebsiteChecklist(
  settings: WebsiteSettings,
  capabilities: MobileStorefrontCapabilities,
): MobileSetupChecklist {
  const filled = (v?: string | null) => Boolean(v && v.trim());
  const company = settings.company_info;
  const checkout = settings.checkout;
  const hero = settings.hero_content;
  const availability = resolveMobileSectionAvailability(capabilities);
  const focus = resolveWebsiteFocus(capabilities);

  const hasContact = filled(company.whatsapp) || filled(company.phone);
  const identityDone = filled(company.name) && filled(company.logoUrl) && hasContact;
  const missingIdentity = [
    [!filled(company.name), 'nombre'],
    [!filled(company.logoUrl), 'logo'],
    [!hasContact, 'WhatsApp o teléfono'],
  ]
    .filter(([miss]) => miss)
    .map(([, label]) => label as string);

  const mode = checkout?.commerceMode ?? 'cart';
  const payment = checkout?.payment;
  const anyPayment = Boolean(payment && Object.values(payment).some((m) => m?.enabled));
  const salesDone =
    mode === 'catalog' ||
    (mode === 'whatsapp'
      ? filled(company.whatsapp) || filled(company.phone)
      : anyPayment && Boolean(checkout?.delivery?.enabled || checkout?.pickup?.enabled));
  const style = company.storefrontStyle;
  const heroDone = hero?.enabled !== false && filled(hero?.title) && filled(hero?.subtitle);

  const rawEssentials: MobileChecklistStep[] = [
    {
      id: 'identity',
      section: 'company',
      route: ROUTE_BY_SECTION.company,
      title: 'Datos y contacto',
      why: 'Tu nombre, logo y un contacto dan confianza desde el primer vistazo.',
      done: identityDone,
      missing: missingIdentity.length ? `Falta: ${missingIdentity.join(', ')}` : undefined,
      cta: 'Completar datos',
    },
    {
      id: 'appearance',
      section: 'appearance',
      route: ROUTE_BY_SECTION.appearance,
      title: 'Plantilla y colores',
      why: 'Elegí el diseño que mejor va con tu rubro; podés cambiarlo cuando quieras.',
      done: Boolean(style && style !== 'auto'),
      missing: style && style !== 'auto' ? undefined : 'Usás la plantilla automática',
      cta: 'Elegir plantilla',
    },
    {
      id: 'sales',
      section: 'checkout',
      route: ROUTE_BY_SECTION.checkout,
      title: 'Cómo te compran o contactan',
      why: 'Define si compran con carrito, te escriben por WhatsApp o ven el catálogo.',
      done: salesDone,
      missing: salesDone
        ? undefined
        : mode === 'whatsapp'
          ? 'Falta tu WhatsApp'
          : 'Activá al menos un medio de pago y una entrega',
      cta: 'Configurar venta',
    },
    {
      id: 'hero',
      section: 'hero',
      route: ROUTE_BY_SECTION.hero,
      title: 'Portada',
      why: 'Es lo primero que se ve: título claro y botón principal.',
      done: heroDone,
      missing: heroDone ? undefined : hero?.enabled === false ? 'La portada está oculta' : 'Falta título o descripción',
      cta: 'Editar portada',
    },
    {
      id: 'publish',
      section: 'company',
      route: '/admin/website/domain',
      title: 'Publicar la tienda',
      why: 'Mientras no la publiques, nadie más puede ver tu sitio.',
      done: company.storefrontPublic === true,
      missing: company.storefrontPublic ? undefined : 'Tu tienda todavía no es pública',
      cta: 'Publicar',
    },
  ];
  const essentials = rawEssentials.filter((s) => availability[s.section].available);

  const activeServices = (settings.services ?? []).filter((s) => s.active !== false).length;
  const activeTrust = (settings.trust_bar?.items ?? []).filter((i) => i.active !== false).length;
  const trustDone = settings.trust_bar?.enabled !== false && activeTrust >= 2;

  const servicesStep: MobileChecklistStep = {
    id: 'services',
    section: 'services',
    route: ROUTE_BY_SECTION.services,
    title: 'Servicios con precio y duración',
    why: 'El cliente decide rápido cuando ve qué incluye cada servicio y cuánto cuesta.',
    done: company.servicesPageEnabled !== false && activeServices > 0,
    missing: activeServices > 0 ? undefined : 'Todavía no hay servicios activos',
    cta: 'Cargar servicios',
  };
  const trustStep: MobileChecklistStep = {
    id: 'trust_bar',
    section: 'trust_bar',
    route: ROUTE_BY_SECTION.trust_bar,
    title: 'Beneficios',
    why: 'Dos o tres ventajas concretas (envíos, garantía, atención) bajan dudas.',
    done: trustDone,
    missing: trustDone ? undefined : 'Mostrá al menos 2 beneficios',
    cta: 'Elegir beneficios',
  };

  let rawRecommended: MobileChecklistStep[];
  if (focus === 'services') {
    const images = settings.gallery_section?.images?.length ?? 0;
    const galleryDone = Boolean(settings.gallery_section?.enabled) && images >= 3;
    rawRecommended = [
      {
        id: 'booking',
        section: 'booking',
        route: ROUTE_BY_SECTION.booking,
        title: 'Reservas online',
        why: 'Tus clientes eligen servicio, profesional y horario sin escribirte.',
        done: Boolean(settings.booking_section?.enabled),
        missing: settings.booking_section?.enabled ? undefined : 'La sección está oculta',
        cta: 'Activar reservas',
      },
      servicesStep,
      {
        id: 'gallery',
        section: 'gallery',
        route: ROUTE_BY_SECTION.gallery,
        title: 'Galería de trabajos',
        why: 'Las fotos reales convencen a clientes nuevos.',
        done: galleryDone,
        missing: galleryDone ? undefined : `Subí al menos 3 fotos (${images} ahora)`,
        cta: 'Subir fotos',
      },
      trustStep,
    ];
  } else if (focus === 'repairs') {
    const stepsCount =
      (settings.process_flows?.length
        ? settings.process_flows.flatMap((f) => f.steps).length
        : settings.process_steps?.length) ?? 0;
    const processDone = company.processSectionEnabled !== false && stepsCount > 0;
    rawRecommended = [
      servicesStep,
      {
        id: 'process',
        section: 'process',
        route: ROUTE_BY_SECTION.process,
        title: 'Cómo atendés',
        why: 'Contar diagnóstico, presupuesto y entrega da tranquilidad.',
        done: processDone,
        missing: processDone ? undefined : 'Agregá las etapas de tu atención',
        cta: 'Contar el proceso',
      },
      trustStep,
    ];
  } else {
    const activeSlides = (settings.promotional_carousel?.slides ?? []).filter((s) => s.active !== false).length;
    const bannersDone = settings.promotional_carousel?.enabled !== false && activeSlides > 0;
    rawRecommended = [
      trustStep,
      {
        id: 'carousel',
        section: 'carousel',
        route: ROUTE_BY_SECTION.carousel,
        title: 'Un banner de campaña',
        why: 'Una imagen con tu mejor promoción le da vida a la portada.',
        done: bannersDone,
        missing: bannersDone ? undefined : 'No hay banners activos',
        cta: 'Crear banner',
      },
      {
        id: 'offers',
        section: 'offers',
        route: ROUTE_BY_SECTION.offers,
        title: 'Ofertas',
        why: 'Muestra automáticamente tus productos con descuento.',
        done: settings.offers_section?.enabled !== false,
        missing: settings.offers_section?.enabled === false ? 'La sección está oculta' : undefined,
        cta: 'Revisar ofertas',
      },
    ];
  }

  const recommended = rawRecommended.filter((s) => availability[s.section].available);
  const all = [...essentials, ...recommended];
  return {
    focus,
    essentials,
    recommended,
    done: all.filter((s) => s.done).length,
    total: all.length,
    next: all.find((s) => !s.done) ?? null,
  };
}

// ─── Secciones del inicio ──────────────────────────────────────────────────

export type HomeSection = {
  id: string;
  label: string;
  hint: string;
  setting: 'company_info' | EditableSettingKey;
  field: string;
  defaultOn: boolean;
  /** Ruta nativa para configurar su contenido. */
  editRoute?: string;
  /** Id en `resolveMobileSectionAvailability` para filtrar por módulos. */
  availabilityKey?: WebsiteSectionId;
};

export const HOME_SECTIONS: readonly HomeSection[] = [
  { id: 'hero', label: 'Portada', hint: 'Titular y botones de inicio', setting: 'hero_content', field: 'enabled', defaultOn: true },
  { id: 'hero_stats', label: 'Cifras de la portada', hint: 'Números destacados bajo el título', setting: 'hero_stats', field: 'enabled', defaultOn: true },
  { id: 'trust_bar', label: 'Beneficios', hint: 'Garantías, envíos y medios de pago', setting: 'trust_bar', field: 'enabled', defaultOn: false, editRoute: '/admin/website/benefits', availabilityKey: 'trust_bar' },
  { id: 'carousel', label: 'Banners promocionales', hint: 'Campañas rotativas', setting: 'promotional_carousel', field: 'enabled', defaultOn: false, editRoute: '/admin/website/banners', availabilityKey: 'carousel' },
  { id: 'offers', label: 'Ofertas', hint: 'Productos con descuento', setting: 'offers_section', field: 'enabled', defaultOn: false, editRoute: '/admin/website/offers', availabilityKey: 'offers' },
  { id: 'brands', label: 'Marcas destacadas', hint: 'Marquesina de marcas', setting: 'brands_section', field: 'enabled', defaultOn: false, editRoute: '/admin/website/brands', availabilityKey: 'brands' },
  { id: 'booking', label: 'Reservas y citas online', hint: 'Turnos, citas técnicas o asesoramiento en el inicio', setting: 'booking_section', field: 'enabled', defaultOn: false, editRoute: '/admin/website/booking', availabilityKey: 'booking' },
  { id: 'gallery', label: 'Galería de fotos', hint: 'Imágenes destacadas de trabajos o local', setting: 'gallery_section', field: 'enabled', defaultOn: false, editRoute: '/admin/website/gallery', availabilityKey: 'gallery' },
  { id: 'process', label: 'Cómo atendemos', hint: 'Pasos de compra o reparación', setting: 'company_info', field: 'processSectionEnabled', defaultOn: true, editRoute: '/admin/website/process', availabilityKey: 'process' },
];

export function sectionEnabled(settings: WebsiteSettings, section: HomeSection): boolean {
  const holder = settings[section.setting] as Record<string, unknown> | undefined;
  const value = holder?.[section.field];
  return typeof value === 'boolean' ? value : section.defaultOn;
}

// ─── Reservas y citas ──────────────────────────────────────────────────────

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

// ─── Hero Presets y Campos según plantilla ─────────────────────────────────

export type HeroPresetId =
  | 'tech'
  | 'fashion'
  | 'cosmetics'
  | 'services'
  | 'repairs'
  | 'electro'
  | 'barbershop'
  | 'food'
  | 'general';

export type HeroPreset = {
  id: HeroPresetId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaPrimaryText: string;
  ctaSecondaryText: string;
  trustBadges: [string, string, string];
};

export const HERO_PRESETS: readonly HeroPreset[] = [
  {
    id: 'tech',
    label: 'Tecnología & Celulares',
    badge: 'Tecnología & celulares',
    title: 'Lo último en tecnología con atención personalizada',
    subtitle: 'Equipos, accesorios y productos seleccionados con entrega rápida.',
    ctaPrimaryText: 'Ver productos',
    ctaSecondaryText: 'Escribinos por WhatsApp',
    trustBadges: ['Atención especializada', 'Equipos y accesorios', 'Envíos a todo el país'],
  },
  {
    id: 'fashion',
    label: 'Moda, Calzado & Accesorios',
    badge: 'Nueva temporada',
    title: 'Estilo, calidad y las mejores marcas para vos',
    subtitle: 'Encontrá las últimas novedades, ofertas exclusivas y envíos rápidos a tu puerta.',
    ctaPrimaryText: 'Ver colección',
    ctaSecondaryText: 'Consultar talles',
    trustBadges: ['Prendas seleccionadas', 'Atención personalizada', 'Envíos disponibles'],
  },
  {
    id: 'cosmetics',
    label: 'Cosmética & Belleza',
    badge: 'Cuidado & belleza',
    title: 'Realzá tu belleza con productos de confianza',
    subtitle: 'Cosmética y cuidado personal, con asesoramiento y entregas rápidas.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir asesoramiento',
    trustBadges: ['Cuidado personal', 'Asesoría personalizada', 'Envíos disponibles'],
  },
  {
    id: 'barbershop',
    label: 'Barbería & Peluquería',
    badge: 'Reservá tu turno',
    title: 'Tu estilo, en buenas manos',
    subtitle: 'Cortes, barba y color con profesionales. Elegí el servicio y reservá en un minuto.',
    ctaPrimaryText: 'Reservar turno',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Turnos online', 'Profesionales', 'Atención personalizada'],
  },
  {
    id: 'food',
    label: 'Alimentos & Gastronomía',
    badge: 'Fresco todos los días',
    title: 'Lo rico de siempre, directo a tu mesa',
    subtitle: 'Hacé tu pedido online y recibilo en tu casa o pasá a retirarlo listo.',
    ctaPrimaryText: 'Hacer mi pedido',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Productos frescos', 'Delivery en el día', 'Retiro en el local'],
  },
  {
    id: 'electro',
    label: 'Ferretería, Hogar & Bazar',
    badge: 'Todo para tu hogar',
    title: 'Todo lo que tu hogar necesita al mejor precio',
    subtitle: 'Herramientas, materiales y equipamiento con stock disponible y envíos a domicilio u obra.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir cotización',
    trustBadges: ['Stock disponible', 'Asesoramiento técnico', 'Precios especiales'],
  },
  {
    id: 'services',
    label: 'Servicios Profesionales',
    badge: 'Atención profesional',
    title: 'Soluciones profesionales a tu medida',
    subtitle: 'Servicios claros, atención personalizada y presupuestos sin sorpresas.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Solicitar presupuesto',
    trustBadges: ['Atención directa', 'Presupuestos claros', 'Trabajo profesional'],
  },
  {
    id: 'repairs',
    label: 'Servicio Técnico & Reparaciones',
    badge: 'Servicio técnico',
    title: 'Reparamos tu equipo en tiempo récord con total confianza',
    subtitle: 'Diagnóstico claro, repuestos de calidad y seguimiento online de tu reparación.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Consultar falla',
    trustBadges: ['Diagnóstico inicial', 'Atención en taller', 'Seguimiento online'],
  },
  {
    id: 'general',
    label: 'Comercio General / Multi-rubro',
    badge: 'Tienda oficial',
    title: 'Los mejores productos con atención personalizada',
    subtitle: 'Explorá nuestro catálogo online con stock actualizado, promociones exclusivas y envíos rápidos.',
    ctaPrimaryText: 'Explorar tienda',
    ctaSecondaryText: 'Contactar',
    trustBadges: ['Atención directa', 'Catálogo variado', 'Envíos a todo el país'],
  },
];

export function compatibleHeroPresets(capabilities: MobileStorefrontCapabilities): HeroPreset[] {
  const orderedIds: HeroPresetId[] = capabilities.hasRepairs
    ? ['repairs', 'tech', 'services', 'general']
    : capabilities.businessVertical === 'barbershop'
      ? ['barbershop', 'services', 'general']
      : capabilities.operatingModel === 'service' && capabilities.hasServices
        ? ['services', 'general']
        : (
            ({
              clothing: ['fashion', 'general'],
              cosmetics: ['cosmetics', 'general'],
              electronics: ['tech', 'general'],
              hardware: ['electro', 'general'],
              food: ['food', 'general'],
            } as Partial<Record<BusinessVertical, HeroPresetId[]>>)[capabilities.businessVertical] ?? ['general']
          );
  const picked = orderedIds
    .map((id) => HERO_PRESETS.find((p) => p.id === id))
    .filter((p): p is HeroPreset => Boolean(p));
  const rest = HERO_PRESETS.filter((p) => !orderedIds.includes(p.id));
  return [...picked, ...rest];
}

export function heroFieldsForStyle(
  style: StorefrontStyle,
  capabilities: Pick<MobileStorefrontCapabilities, 'tracking'>,
) {
  const campaign =
    style === 'classic' ||
    style === 'fashion' ||
    style === 'tech' ||
    style === 'modern' ||
    style === 'beauty';
  return {
    buttons: style !== 'market',
    tracking: campaign && capabilities.tracking.kind === 'repairs',
    stats: style === 'classic',
  };
}

// ─── Carrusel y guía por rubro ─────────────────────────────────────────────

export const TITLE_COLOR_PRESETS = [
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Oro / Amarillo', value: '#facc15' },
  { label: 'Naranja', value: '#fb923c' },
  { label: 'Verde', value: '#4ade80' },
  { label: 'Celeste', value: '#38bdf8' },
  { label: 'Negro', value: '#09090b' },
] as const;

export type CarouselExampleSlide = {
  title: string;
  message: string;
  imageUrl: string;
  imageAlt: string;
  ctaText?: string;
  ctaHref?: string;
  contentAlign?: 'left' | 'center' | 'right';
  textTone?: 'light' | 'dark';
  badge?: string;
};

export type CarouselExample = {
  name: string;
  category: string;
  needs: 'catalog' | 'services' | 'repairs';
  verticals?: readonly string[];
  slide: CarouselExampleSlide;
};

export const CAROUSEL_EXAMPLES: readonly CarouselExample[] = [
  {
    name: 'Reservá tu turno',
    category: 'Servicios',
    needs: 'services',
    verticals: ['barbershop', 'beauty_services', 'cosmetics', 'general', 'other'],
    slide: { title: 'Reservá tu turno online', message: 'Elegí el servicio, el día y el horario en un minuto. Sin llamadas ni esperas.', imageUrl: '', imageAlt: '', ctaText: 'Reservar turno', ctaHref: '/turnos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Promo de la semana',
    category: 'Servicios',
    needs: 'services',
    verticals: ['barbershop', 'beauty_services', 'cosmetics', 'general', 'other'],
    slide: { title: 'Precio especial de lunes a jueves', message: 'Aprovechá la promo de la semana: reservá tu lugar antes de que se llenen los horarios.', imageUrl: '', imageAlt: '', ctaText: 'Reservar ahora', ctaHref: '/turnos', textTone: 'light', contentAlign: 'center' },
  },
  {
    name: 'Accesorios Tech',
    category: 'Tecnología',
    needs: 'catalog',
    verticals: ['electronics', 'general', 'other'],
    slide: { title: 'Todo para acompañar tu celular', message: 'Descubrí cargadores, cables, auriculares y fundas seleccionadas con garantía.', imageUrl: '', imageAlt: '', ctaText: 'Ver accesorios', ctaHref: '/productos', textTone: 'dark', contentAlign: 'left' },
  },
  {
    name: 'Renovación de Celulares',
    category: 'Tecnología',
    needs: 'catalog',
    verticals: ['electronics', 'general', 'other'],
    slide: { title: 'Encontrá tu próximo celular', message: 'Conocé los equipos disponibles y elegí el que mejor se adapta a vos con financiación.', imageUrl: '', imageAlt: '', ctaText: 'Ver celulares', ctaHref: '/productos', textTone: 'dark', contentAlign: 'right' },
  },
  {
    name: 'Servicio Técnico Especializado',
    category: 'Reparaciones',
    needs: 'repairs',
    slide: { title: 'Tu equipo en manos expertas', message: 'Diagnóstico claro, repuestos originales y reparación profesional con seguimiento online.', imageUrl: '', imageAlt: '', ctaText: 'Seguir mi reparación', ctaHref: '/mis-reparaciones', textTone: 'dark', contentAlign: 'left' },
  },
  {
    name: 'Nueva Colección de Ropa',
    category: 'Moda',
    needs: 'catalog',
    verticals: ['clothing', 'general', 'other'],
    slide: { title: 'Nueva Colección de Temporada', message: 'Renová tu estilo con las últimas tendencias en prendas y calzados exclusivos.', imageUrl: '', imageAlt: '', ctaText: 'Ver colección', ctaHref: '/productos', textTone: 'dark', contentAlign: 'right' },
  },
  {
    name: 'Skincare & Belleza',
    category: 'Cosmética',
    needs: 'catalog',
    verticals: ['cosmetics', 'beauty_services', 'general', 'other'],
    slide: { title: 'Cuidado Personal & Skincare', message: 'Productos 100% originales para realzar tu belleza y cuidar tu piel día a día.', imageUrl: '', imageAlt: '', ctaText: 'Explorar catálogo', ctaHref: '/productos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Ofertas de la semana',
    category: 'Alimentos',
    needs: 'catalog',
    verticals: ['food', 'general', 'other'],
    slide: { title: 'Ofertas de la semana', message: 'Precios especiales en tus productos de todos los días, hasta agotar stock.', imageUrl: '', imageAlt: '', ctaText: 'Ver ofertas', ctaHref: '/productos?ofertas=true', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Envíos Gratis a Todo el País',
    category: 'Promociones',
    needs: 'catalog',
    slide: { title: 'Envíos Gratis a Todo el País', message: 'Hacé tu pedido hoy y recibilo en tu casa sin costo adicional.', imageUrl: '', imageAlt: '', ctaText: 'Comprar ahora', ctaHref: '/productos', textTone: 'light', contentAlign: 'center' },
  },
];

export type CarouselContext = Pick<
  MobileStorefrontCapabilities,
  'businessVertical' | 'hasCatalog' | 'hasServices' | 'hasRepairs'
>;

export function carouselExamplesFor(context: CarouselContext) {
  const usable = CAROUSEL_EXAMPLES.filter((example) =>
    example.needs === 'catalog'
      ? context.hasCatalog
      : example.needs === 'services'
        ? context.hasServices
        : context.hasRepairs,
  );
  const fits = (example: CarouselExample) =>
    !example.verticals || example.verticals.includes(context.businessVertical);
  const relevant = usable.filter(fits);
  return [...relevant, ...usable.filter((example) => !fits(example))].map((example) => ({
    ...example,
    recommended: Boolean(example.verticals?.includes(context.businessVertical)),
  }));
}

export function carouselLinkShortcuts(context: CarouselContext) {
  return [
    ...(context.hasServices
      ? [
          { label: 'Turnos (/turnos)', href: '/turnos' },
          { label: 'Servicios (/servicios)', href: '/servicios' },
        ]
      : []),
    ...(context.hasCatalog
      ? [
          { label: 'Catálogo (/productos)', href: '/productos' },
          { label: 'Ofertas (/ofertas)', href: '/ofertas' },
        ]
      : []),
    ...(context.hasRepairs
      ? [{ label: 'Reparaciones (/mis-reparaciones)', href: '/mis-reparaciones' }]
      : []),
  ];
}

export function slideLinkProblem(href: string | undefined, context: CarouselContext): string | null {
  const path = (href ?? '').trim().split(/[?#]/)[0];
  if (!path || !path.startsWith('/')) return null;
  if (path === '/productos' && !context.hasCatalog) {
    return 'Lleva al catálogo, pero tu tienda no vende productos.';
  }
  if ((path === '/servicios' || path === '/turnos') && !context.hasServices) {
    return 'Lleva a los servicios, pero tu tienda no tiene la agenda activa.';
  }
  if (path === '/mis-reparaciones' && !context.hasRepairs) {
    return 'Lleva a reparaciones, pero tu tienda no tiene ese módulo.';
  }
  return null;
}

export function carouselPlacement(style: StorefrontStyle) {
  if (style === 'classic') {
    return {
      replacesHero: false,
      text: 'En tu plantilla Clásica el carrusel aparece debajo de la portada principal.',
    };
  }
  return {
    replacesHero: true,
    text:
      style === 'services'
        ? 'En tu plantilla Servicios, si activás banners estos reemplazan la portada («Reservar turno», horario y dirección).'
        : 'En tu plantilla actual, si activás banners estos reemplazan la portada principal.',
  };
}

// ─── Pagos y entregas (Checkout) ───────────────────────────────────────────

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  commerceMode: 'cart',
  payment: {
    cash: { enabled: true, label: 'Efectivo', instructions: 'Pagás al retirar en el local.' },
    card: { enabled: false, label: 'Tarjeta', instructions: 'Posnet inalámbrico disponible en el local o a domicilio.' },
    transfer: { enabled: false, label: 'Transferencia', instructions: 'Te enviaremos los datos bancarios tras confirmar.' },
    digital_wallet: { enabled: false, label: 'Billetera digital', instructions: 'Te enviaremos el QR o alias tras confirmar.' },
  },
  delivery: {
    enabled: false,
    defaultCost: 0,
    freeThreshold: 0,
    estimatedTime: '30–60 min',
    zoneOptions: [],
    zones: '',
    instructions: '',
  },
  pickup: {
    enabled: true,
    estimatedTime: '20–30 min',
    instructions: '',
  },
  minOrderAmount: 0,
  confirmationMessage: '',
};

export function normalizeCheckoutSettings(raw?: Partial<CheckoutSettings> | null): CheckoutSettings {
  return {
    ...DEFAULT_CHECKOUT_SETTINGS,
    ...(raw ?? {}),
    payment: {
      ...DEFAULT_CHECKOUT_SETTINGS.payment,
      ...(raw?.payment ?? {}),
      cash: { ...DEFAULT_CHECKOUT_SETTINGS.payment.cash, ...(raw?.payment?.cash ?? {}) },
      card: { ...DEFAULT_CHECKOUT_SETTINGS.payment.card, ...(raw?.payment?.card ?? {}) },
      transfer: { ...DEFAULT_CHECKOUT_SETTINGS.payment.transfer, ...(raw?.payment?.transfer ?? {}) },
      digital_wallet: {
        ...DEFAULT_CHECKOUT_SETTINGS.payment.digital_wallet,
        ...(raw?.payment?.digital_wallet ?? {}),
      },
    },
    delivery: {
      ...DEFAULT_CHECKOUT_SETTINGS.delivery,
      ...(raw?.delivery ?? {}),
      zoneOptions: Array.isArray(raw?.delivery?.zoneOptions) ? raw.delivery.zoneOptions : [],
    },
    pickup: {
      ...DEFAULT_CHECKOUT_SETTINGS.pickup,
      ...(raw?.pickup ?? {}),
    },
    minOrderAmount: Number(raw?.minOrderAmount ?? 0) || 0,
  };
}

export function isTransferAccountComplete(option: BankTransferOption): boolean {
  return option.bankName.trim().length >= 2 && Boolean(option.alias?.trim() || option.accountNumber?.trim());
}

export function transferAccounts(transfer: PaymentMethodConfig): BankTransferOption[] {
  if (transfer.transferOptions !== undefined) return transfer.transferOptions;
  if (!transfer.bankName && !transfer.bankAlias && !transfer.bankCbu) return [];
  return [
    {
      id: 'legacy-bank-option',
      bankName: transfer.bankName || 'Cuenta bancaria',
      alias: transfer.bankAlias || '',
      accountNumber: transfer.bankCbu || '',
      accountHolder: '',
    },
  ];
}

export type CartSetupIssue = {
  id: string;
  step: 'payments' | 'delivery' | 'pickup' | 'order';
  level: 'error' | 'warn';
  message: string;
  fixIn?: 'company';
};

export function cartConfigErrors(checkout: CheckoutSettings): CartSetupIssue[] {
  if (checkout.commerceMode !== 'cart') return [];
  const issues: CartSetupIssue[] = [];
  const { payment, delivery } = checkout;
  const anyPayment =
    payment.cash.enabled ||
    payment.card.enabled ||
    payment.transfer.enabled ||
    payment.digital_wallet.enabled;
  if (!anyPayment) {
    issues.push({ id: 'no-payment', step: 'payments', level: 'error', message: 'Activá al menos una forma de pago.' });
  }
  if (payment.transfer.enabled) {
    const accounts = transferAccounts(payment.transfer);
    if (accounts.length === 0) {
      issues.push({
        id: 'transfer-no-account',
        step: 'payments',
        level: 'error',
        message: 'La transferencia necesita al menos una cuenta: banco y alias o número de cuenta.',
      });
    } else if (!accounts.every(isTransferAccountComplete)) {
      issues.push({
        id: 'transfer-incomplete',
        step: 'payments',
        level: 'error',
        message: 'Cada cuenta bancaria necesita banco y alias o número de cuenta.',
      });
    }
  }
  if (
    payment.digital_wallet.enabled &&
    !payment.digital_wallet.walletAlias?.trim() &&
    !payment.digital_wallet.qrImageUrl?.trim()
  ) {
    issues.push({
      id: 'wallet-empty',
      step: 'payments',
      level: 'error',
      message: 'La billetera necesita tu alias o la imagen del QR.',
    });
  }
  if (delivery.enabled) {
    if ((delivery.zoneOptions ?? []).some((z) => z.name.trim().length < 2 || z.cost < 0)) {
      issues.push({
        id: 'zones-invalid',
        step: 'delivery',
        level: 'error',
        message: 'Cada zona de delivery necesita nombre (mín. 2 letras) y costo válido.',
      });
    }
    if (!delivery.estimatedTime.trim()) {
      issues.push({
        id: 'delivery-time',
        step: 'delivery',
        level: 'error',
        message: 'Indicá el tiempo estimado de envío.',
      });
    }
  }
  if (checkout.pickup.enabled && !checkout.pickup.estimatedTime.trim()) {
    issues.push({
      id: 'pickup-time',
      step: 'pickup',
      level: 'error',
      message: 'Indicá en cuánto tiempo está listo para retirar.',
    });
  }
  return issues;
}

export function reviewCartSetup(
  checkout: CheckoutSettings,
  context: { company?: Pick<CompanyInfo, 'address' | 'hours'> | null; deliveryModuleEnabled: boolean },
): CartSetupIssue[] {
  if (checkout.commerceMode !== 'cart') return [];
  const issues = cartConfigErrors(checkout);
  const deliveryOffered = checkout.delivery.enabled && context.deliveryModuleEnabled;
  if (!deliveryOffered && !checkout.pickup.enabled) {
    issues.push({
      id: 'no-fulfillment',
      step: 'pickup',
      level: 'error',
      message: 'Activá el retiro en el local o el envío a domicilio.',
    });
  }
  if (checkout.pickup.enabled && !context.company?.address?.trim()) {
    issues.push({
      id: 'pickup-no-address',
      step: 'pickup',
      level: 'warn',
      fixIn: 'company',
      message: 'Ofrecés retiro pero falta cargar la dirección del local en Negocio.',
    });
  }
  if (deliveryOffered && !(checkout.delivery.zoneOptions?.length) && !checkout.delivery.defaultCost) {
    issues.push({
      id: 'delivery-no-cost',
      step: 'delivery',
      level: 'warn',
      message: 'El delivery no tiene costo ni zonas: el cliente verá «costo a coordinar».',
    });
  }
  const minimum = checkout.minOrderAmount || 0;
  if (minimum > 0 && minimum < 1000) {
    issues.push({
      id: 'min-typo',
      step: 'order',
      level: 'warn',
      message: `Un pedido mínimo de Gs. ${minimum} parece muy bajo.`,
    });
  }
  if (deliveryOffered && checkout.delivery.freeThreshold > 0 && minimum >= checkout.delivery.freeThreshold) {
    issues.push({
      id: 'free-below-min',
      step: 'order',
      level: 'warn',
      message: 'El envío gratis arranca por debajo del pedido mínimo.',
    });
  }
  if (!checkout.confirmationMessage?.trim()) {
    issues.push({
      id: 'no-confirmation',
      step: 'order',
      level: 'warn',
      message: 'Sumá un mensaje de confirmación para indicar qué pasa después del pedido.',
    });
  }
  return issues;
}

export function fillCartTextsFromCompany(
  checkout: CheckoutSettings,
  company: Partial<Pick<CompanyInfo, 'name' | 'address' | 'hours' | 'whatsapp' | 'phone'>> | null | undefined,
): CheckoutSettings {
  const address = company?.address?.trim();
  const hours = company?.hours?.weekdays?.trim();
  const contact = company?.whatsapp?.trim() || company?.phone?.trim();
  const pickupText = [
    address ? `Retirá en ${address}.` : 'Retirá en nuestro local.',
    hours ? `Horario: ${hours}.` : '',
    'Mostrá tu número de pedido al llegar.',
  ]
    .filter(Boolean)
    .join(' ');
  const keep = (current: string | undefined, fallback: string) =>
    current?.trim() ? current : fallback;
  return {
    ...checkout,
    pickup: { ...checkout.pickup, instructions: keep(checkout.pickup.instructions, pickupText) },
    delivery: {
      ...checkout.delivery,
      instructions: keep(
        checkout.delivery.instructions,
        contact ? `Te escribimos al ${contact} cuando el pedido sale.` : 'Te avisamos cuando el pedido sale.',
      ),
    },
    confirmationMessage: keep(
      checkout.confirmationMessage,
      `¡Gracias por tu compra${company?.name ? ` en ${company.name}` : ''}! Recibimos tu pedido y te contactamos${contact ? ` al ${contact}` : ''} para confirmarlo.`,
    ),
  };
}

export type CheckoutRecommendation = {
  mode: CommerceMode;
  summary: string;
  pickup: boolean;
  delivery: boolean;
  cash: boolean;
  card: boolean;
  tips: string[];
};

export const CHECKOUT_RECOMMENDATIONS: Record<GuidanceFamily, CheckoutRecommendation> = {
  beauty_services: { mode: 'catalog', summary: 'Mostrá tus servicios y coordiná la atención.', pickup: true, delivery: false, cash: true, card: false, tips: ['Configurá tus servicios antes de habilitar reservas.'] },
  general: { mode: 'cart', summary: 'Carrito con retiro en el local y efectivo; sumá envíos cuando puedas cumplirlos.', pickup: true, delivery: false, cash: true, card: false, tips: ['Cargá tus cuentas para activar transferencia.', 'Definí zonas de envío con su costo.'] },
  other: { mode: 'whatsapp', summary: 'Consultas por WhatsApp para coordinar precio, pago y entrega.', pickup: true, delivery: false, cash: true, card: false, tips: ['Con precios fijos, el carrito agiliza las ventas.'] },
  clothing: { mode: 'cart', summary: 'Carrito con envío y retiro; muchos clientes consultan el talle antes.', pickup: true, delivery: true, cash: true, card: true, tips: ['Indicá cambios y devoluciones en entrega.', 'Activá transferencia con tus cuentas.'] },
  barbershop: { mode: 'whatsapp', summary: 'Tus turnos van por agenda; los productos por WhatsApp con retiro en local.', pickup: true, delivery: false, cash: true, card: true, tips: ['Activá «Reservas online» en tu inicio.'] },
  cosmetics: { mode: 'cart', summary: 'Carrito con delivery y retiro para reposición rápida.', pickup: true, delivery: true, cash: true, card: true, tips: ['Ofrecé envío gratis desde cierto monto.', 'Activá billetera o QR con tu alias.'] },
  electronics: { mode: 'cart', summary: 'Carrito con retiro y envío; la tarjeta ayuda en compras grandes.', pickup: true, delivery: true, cash: true, card: true, tips: ['Indicá garantía en instrucciones de entrega.'] },
  food: { mode: 'cart', summary: 'Pedidos por carrito con zonas de delivery y pedido mínimo.', pickup: true, delivery: true, cash: true, card: false, tips: ['Definí zonas de delivery con tarifa.', 'Activá QR o billetera digital.'] },
  hardware: { mode: 'whatsapp', summary: 'Consultas por WhatsApp para cotizar materiales o envío a obra.', pickup: true, delivery: true, cash: true, card: true, tips: ['El carrito agiliza compras chicas de mostrador.'] },
  repairs: { mode: 'cart', summary: 'Reparaciones por taller; carrito para accesorios con retiro.', pickup: true, delivery: false, cash: true, card: true, tips: ['Tus clientes siguen su equipo en «Mis reparaciones».'] },
};

// ─── Ofertas ───────────────────────────────────────────────────────────────

export const DEFAULT_OFFERS_SECTION: OffersSectionSettings = {
  enabled: true,
  eyebrow: 'Ofertas especiales',
  title: 'Precios que vale la pena aprovechar',
  subtitle: 'Productos seleccionados con descuentos activos en el catálogo.',
  accentColor: 'rose',
  carousel: {
    enabled: true,
    title: 'Destacados de la semana',
    subtitle: 'Las mejores rebajas activas, en rotación automática.',
    autoplay: true,
    intervalSeconds: 5,
    maxItems: 8,
  },
};

export const DEFAULT_OFFERS_CAROUSEL: PromotionalCarousel = {
  enabled: true,
  autoplay: true,
  intervalSeconds: 6,
  layoutMode: 'contained',
  slides: [],
};

export const OFFERS_ACCENTS: readonly { value: OffersAccentColor; label: string; hex: string }[] = [
  { value: 'brand', label: 'Color de marca', hex: '#2563EB' },
  { value: 'rose', label: 'Rosa', hex: '#F43F5E' },
  { value: 'amber', label: 'Ámbar', hex: '#F59E0B' },
  { value: 'orange', label: 'Naranja', hex: '#F97316' },
  { value: 'emerald', label: 'Esmeralda', hex: '#10B981' },
  { value: 'blue', label: 'Azul', hex: '#3B82F6' },
  { value: 'sky', label: 'Celeste', hex: '#0EA5E9' },
  { value: 'violet', label: 'Violeta', hex: '#8B5CF6' },
  { value: 'fuchsia', label: 'Fucsia', hex: '#D946EF' },
  { value: 'red', label: 'Rojo', hex: '#EF4444' },
  { value: 'teal', label: 'Turquesa', hex: '#14B8A6' },
];

export function offersSectionIssues(offers: Partial<OffersSectionSettings>): Record<string, string> {
  const issues: Record<string, string> = {};
  if ((offers.eyebrow ?? '').trim().length < 2) issues.eyebrow = 'Mínimo 2 caracteres.';
  if ((offers.title ?? '').trim().length < 3) issues.title = 'Mínimo 3 caracteres.';
  if ((offers.subtitle ?? '').trim().length < 5) issues.subtitle = 'Mínimo 5 caracteres.';
  if (offers.carousel && (offers.carousel.title ?? '').trim().length < 3) {
    issues.carouselTitle = 'El título del carrusel necesita al menos 3 caracteres.';
  }
  return issues;
}

// ─── Beneficios / Trust Bar ────────────────────────────────────────────────

export const DEFAULT_TRUST_BAR: TrustBarSettings = {
  enabled: true,
  position: 'above_carousel',
  items: [
    { id: 'shipping', icon: 'package', title: 'Retiro o envío', description: 'Coordinamos la entrega con vos', active: true },
    { id: 'payment', icon: 'credit-card', title: 'Medios de pago', description: 'Consultá las opciones disponibles', active: true },
    { id: 'warranty', icon: 'shield', title: 'Compra clara', description: 'Precios y condiciones a la vista', active: true },
    { id: 'support', icon: 'message', title: 'Atención Directa', description: 'Asesoramiento personalizado', active: true },
  ],
};

export const TRUST_BAR_POSITIONS: readonly { value: TrustBarPosition; label: string; description: string }[] = [
  { value: 'above_carousel', label: 'Arriba de banners', description: 'Apenas debajo de la portada.' },
  { value: 'below_carousel', label: 'Debajo de banners', description: 'Antes de las categorías.' },
  { value: 'bottom', label: 'Al final', description: 'Antes del pie de página.' },
];

export const TRUST_BAR_ICONS: readonly { value: string; label: string; ionicon: string }[] = [
  { value: 'truck', label: 'Envíos', ionicon: 'car-outline' },
  { value: 'credit-card', label: 'Pagos', ionicon: 'card-outline' },
  { value: 'shield', label: 'Garantía', ionicon: 'shield-checkmark-outline' },
  { value: 'message', label: 'WhatsApp', ionicon: 'chatbubble-ellipses-outline' },
  { value: 'star', label: 'Calidad', ionicon: 'star-outline' },
  { value: 'award', label: 'Oficial', ionicon: 'ribbon-outline' },
  { value: 'zap', label: 'Rápido', ionicon: 'flash-outline' },
  { value: 'clock', label: 'Horarios', ionicon: 'time-outline' },
  { value: 'wrench', label: 'Taller', ionicon: 'construct-outline' },
  { value: 'package', label: 'Stock', ionicon: 'cube-outline' },
  { value: 'map-pin', label: 'Local', ionicon: 'location-outline' },
  { value: 'thumbs-up', label: 'Recomendado', ionicon: 'thumbs-up-outline' },
  { value: 'sparkles', label: 'Novedades', ionicon: 'sparkles-outline' },
  { value: 'handshake', label: 'Atención', ionicon: 'people-outline' },
  { value: 'check', label: 'Verificado', ionicon: 'checkmark-circle-outline' },
];

export const TRUST_BAR_IDEAS: Record<GuidanceFamily, { icon: string; title: string; description: string }[]> = {
  beauty_services: [{ icon: 'message', title: 'Consultá los servicios', description: 'Encontrá la atención que buscás' }],
  general: [
    { icon: 'truck', title: 'Envíos a domicilio', description: 'Coordinamos la entrega en tu zona' },
    { icon: 'map-pin', title: 'Retiro en el local', description: 'Pasá a buscar tu pedido sin costo' },
    { icon: 'credit-card', title: 'Varias formas de pago', description: 'Efectivo, transferencia o tarjeta' },
    { icon: 'message', title: 'Atención por WhatsApp', description: 'Respondemos tus consultas' },
  ],
  clothing: [
    { icon: 'package', title: 'Cambios fáciles', description: 'Si no te queda, lo cambiamos' },
    { icon: 'message', title: 'Te ayudamos con el talle', description: 'Consultanos antes de comprar' },
    { icon: 'truck', title: 'Envíos a todo el país', description: 'Recibilo en tu casa' },
    { icon: 'credit-card', title: 'Pagá como quieras', description: 'Transferencia, tarjeta o efectivo' },
  ],
  barbershop: [
    { icon: 'clock', title: 'Reservá tu turno', description: 'Elegí el día y la hora que te queden bien' },
    { icon: 'star', title: 'Profesionales con experiencia', description: 'Cortes y barbas a tu estilo' },
    { icon: 'check', title: 'Atención cuidada', description: 'Espacio preparado para tu visita' },
    { icon: 'credit-card', title: 'Pagá en el local', description: 'Efectivo, transferencia o tarjeta' },
  ],
  cosmetics: [
    { icon: 'award', title: 'Cuidado personal', description: 'Productos seleccionados para tu rutina' },
    { icon: 'handshake', title: 'Asesoramiento personalizado', description: 'Te ayudamos a elegir según tu piel' },
    { icon: 'truck', title: 'Envíos rápidos', description: 'Recibí tu pedido en tu casa' },
    { icon: 'sparkles', title: 'Novedades cada semana', description: 'Lanzamientos y tendencias' },
  ],
  electronics: [
    { icon: 'shield', title: 'Atención técnica', description: 'Asesoramiento antes y después de comprar' },
    { icon: 'award', title: 'Equipos y accesorios', description: 'Variedad de marcas y modelos' },
    { icon: 'credit-card', title: 'Pagá en cuotas', description: 'Consultá los planes disponibles' },
    { icon: 'truck', title: 'Envíos a todo el país', description: 'Despacho rápido y seguro' },
  ],
  food: [
    { icon: 'zap', title: 'Delivery en el día', description: 'Pedí hoy y recibilo hoy' },
    { icon: 'star', title: 'Siempre fresco', description: 'Productos seleccionados todos los días' },
    { icon: 'map-pin', title: 'Retiro en el local', description: 'Pasá a buscarlo cuando quieras' },
    { icon: 'credit-card', title: 'Pagá al recibir', description: 'Efectivo, transferencia o QR' },
  ],
  hardware: [
    { icon: 'package', title: 'Stock disponible', description: 'Lo que buscás, listo para llevar' },
    { icon: 'handshake', title: 'Te asesoramos', description: 'Te ayudamos a elegir el material justo' },
    { icon: 'truck', title: 'Envíos a obra', description: 'Llevamos tu pedido a domicilio u obra' },
    { icon: 'credit-card', title: 'Precios para profesionales', description: 'Consultá por cantidad' },
  ],
  other: [
    { icon: 'handshake', title: 'Atención personalizada', description: 'Te ayudamos en cada paso' },
    { icon: 'message', title: 'Respondemos rápido', description: 'Escribinos por WhatsApp' },
    { icon: 'credit-card', title: 'Varias formas de pago', description: 'Efectivo, transferencia o tarjeta' },
  ],
  repairs: [
    { icon: 'wrench', title: 'Diagnóstico inicial', description: 'Revisamos tu equipo antes de presupuestar' },
    { icon: 'shield', title: 'Reparaciones probadas', description: 'Probamos cada equipo antes de entregar' },
    { icon: 'zap', title: 'Reparaciones en el día', description: 'En la mayoría de los casos' },
    { icon: 'check', title: 'Seguí tu reparación', description: 'Consultá el estado online' },
  ],
};

export function trustBarIssues(trustBar: Partial<TrustBarSettings>): Record<string, string> {
  const issues: Record<string, string> = {};
  const items = trustBar.items ?? [];
  if (items.length > 6) issues.items = 'Máximo 6 beneficios permitidos.';
  items.forEach((item, index) => {
    if (!item.title?.trim()) issues[`item_${index}`] = `El beneficio #${index + 1} necesita un título.`;
  });
  return issues;
}

// ─── Marcas destacadas ─────────────────────────────────────────────────────

export const DEFAULT_BRANDS_SECTION: BrandsSectionSettings = {
  enabled: false,
  title: 'Marcas destacadas',
  subtitle: 'Encontrá productos y marcas destacadas',
  showOnHome: false,
  showOnProducts: false,
  showOnOffers: false,
  items: [],
};

export const POPULAR_PRESET_BRANDS_META: readonly { id: string; name: string; category: 'sports' | 'fashion' }[] = [
  { id: 'nike', name: 'Nike', category: 'sports' },
  { id: 'adidas', name: 'Adidas', category: 'sports' },
  { id: 'puma', name: 'Puma', category: 'sports' },
  { id: 'under-armour', name: 'Under Armour', category: 'sports' },
  { id: 'reebok', name: 'Reebok', category: 'sports' },
  { id: 'new-balance', name: 'New Balance', category: 'sports' },
  { id: 'zara', name: 'Zara', category: 'fashion' },
  { id: 'vans', name: 'Vans', category: 'fashion' },
];

export function getBrandEditorGuidance(vertical?: string | null): { hint: string; placeholder: string; categories: string[] } {
  const entries: Record<string, { hint: string; placeholder: string; categories: string[] }> = {
    clothing: { hint: 'Mostrá marcas de indumentaria y accesorios que realmente vendés.', placeholder: 'Marca de indumentaria', categories: ['sports', 'fashion'] },
    electronics: { hint: 'Elegí fabricantes de equipos o accesorios de tu catálogo.', placeholder: 'Marca de equipos', categories: [] },
    cosmetics: { hint: 'Destacá las marcas de cosméticos y cuidado personal que ofrecés.', placeholder: 'Marca de cosmética', categories: [] },
    beauty_services: { hint: 'Opcional: mostrá marcas que usás o vendés.', placeholder: 'Marca de productos', categories: [] },
    barbershop: { hint: 'Opcional: mostrá marcas de cuidado capilar del local.', placeholder: 'Marca capilar', categories: [] },
    food: { hint: 'Mostrá marcas de alimentos o bebidas que ofrecés.', placeholder: 'Marca de alimentos', categories: [] },
    hardware: { hint: 'Destacá fabricantes de herramientas y materiales de tu catálogo.', placeholder: 'Marca de herramientas', categories: [] },
    general: { hint: 'Priorizá las marcas reales de tu catálogo.', placeholder: 'Nombre de la marca', categories: [] },
  };
  return entries[vertical ?? 'general'] ?? entries.general;
}

export function brandsSectionIssues(brands: Partial<BrandsSectionSettings>): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!brands.title?.trim()) issues.title = 'El título es requerido.';
  const items = brands.items ?? [];
  if (items.length > 36) issues.items = 'Máximo 36 marcas permitidas.';
  items.forEach((item, index) => {
    if (!item.name?.trim()) issues[`item_${index}_name`] = `La marca #${index + 1} necesita un nombre.`;
    if (item.href && !isSafeLinkOrPath(item.href)) issues[`item_${index}_href`] = 'Usá una ruta (/...) o URL http(s).';
  });
  return issues;
}

// ─── Avisos emergentes (Announcements) ──────────────────────────────────────

export const MAX_STORE_ANNOUNCEMENTS = 3;
export const MAX_ANNOUNCEMENT_IMAGES = 5;

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
};

export const ANNOUNCEMENT_BADGE_PRESETS = [
  '✨ Novedad destacada',
  '🔥 Oferta especial',
  '🚀 Nuevo lanzamiento',
  '📢 Aviso importante',
  '🎉 Promoción',
  '⚡ Solo por hoy',
] as const;

export const ANNOUNCEMENT_BADGE_VARIANTS: readonly {
  value: AnnouncementBadgeVariant;
  label: string;
  hex: string;
}[] = [
  { value: 'primary', label: 'Azul / Marca', hex: '#2563EB' },
  { value: 'amber', label: 'Ámbar', hex: '#D97706' },
  { value: 'emerald', label: 'Verde', hex: '#059669' },
  { value: 'purple', label: 'Púrpura', hex: '#9333EA' },
  { value: 'rose', label: 'Rosa', hex: '#E11D48' },
  { value: 'cyan', label: 'Celeste', hex: '#0891B2' },
  { value: 'indigo', label: 'Índigo', hex: '#4F46E5' },
  { value: 'orange', label: 'Naranja', hex: '#EA580C' },
  { value: 'teal', label: 'Turquesa', hex: '#0D9488' },
  { value: 'slate', label: 'Grafito', hex: '#475569' },
];

export const ANNOUNCEMENT_FREQUENCIES: readonly {
  value: AnnouncementFrequency;
  label: string;
  description: string;
}[] = [
  { value: 'once_per_day', label: 'Una vez al día (Recomendado)', description: 'Si lo cierran hoy, no vuelve hasta mañana.' },
  { value: 'always', label: 'Cada visita', description: 'Ideal para promos flash o alertas urgentes.' },
  { value: 'once_per_session', label: 'Una vez por sesión', description: 'Se muestra una vez por pestaña abierta.' },
];

export const ANNOUNCEMENT_DURATIONS = [
  { value: 5, label: '5s (Recomendado)' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 0, label: 'Manual' },
] as const;

export const ANNOUNCEMENT_BACKDROPS: readonly { value: AnnouncementImageBackdrop; label: string }[] = [
  { value: 'ambient', label: 'Ambiental' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'tinted', label: 'Tinte' },
  { value: 'light', label: 'Claro' },
];

export const ANNOUNCEMENT_FITS: readonly { value: AnnouncementImageFit; label: string }[] = [
  { value: 'contain', label: 'Completa sin cortes' },
  { value: 'cover', label: 'Relleno total' },
];

export const ANNOUNCEMENT_EFFECTS: readonly { value: AnnouncementImageEffect; label: string }[] = [
  { value: 'zoom', label: 'Zoom suave' },
  { value: 'glow', label: 'Resplandor' },
  { value: 'none', label: 'Estático' },
];

export const ANNOUNCEMENT_IDEAS: Record<GuidanceFamily, { title: string; message: string }[]> = {
  beauty_services: [{ title: 'Nuestros servicios', message: 'Consultá los servicios y horarios disponibles.' }],
  general: [
    { title: 'Horario especial', message: 'Este feriado atendemos de 8 a 12. ¡Te esperamos!' },
    { title: 'Ofertas de la semana', message: 'Aprovechá los precios especiales hasta el domingo.' },
  ],
  clothing: [
    { title: 'Nueva temporada', message: 'Ya llegó la colección nueva. ¡Mirala antes que nadie!' },
    { title: 'Cambios', message: 'Tenés 30 días para cambiar tu compra con el ticket.' },
  ],
  barbershop: [
    { title: 'Reservá online', message: 'Ahora podés sacar tu turno desde acá, en un minuto.' },
    { title: 'Horario especial', message: 'Este sábado atendemos hasta las 20 h.' },
  ],
  cosmetics: [
    { title: 'Lanzamiento', message: 'Llegaron las novedades de la temporada. ¡Conocelas!' },
    { title: 'Regalo con tu compra', message: 'Llevate una muestra de regalo en compras superiores a Gs. 200.000.' },
  ],
  electronics: [
    { title: 'Cuotas sin interés', message: 'Este mes llevá tu equipo en cuotas. Consultanos.' },
    { title: 'Ingresos nuevos', message: 'Llegaron equipos nuevos: mirá el catálogo.' },
  ],
  food: [
    { title: 'Pedidos para el finde', message: 'Hacé tu pedido hasta el viernes a las 18 h para recibirlo el sábado.' },
    { title: 'Horario de delivery', message: 'Entregamos de lunes a sábado de 9 a 20 h.' },
  ],
  hardware: [
    { title: 'Envíos a obra', message: 'Llevamos tu pedido a la obra. Consultá zonas y costos.' },
    { title: 'Horario especial', message: 'Este sábado abrimos de 7 a 12.' },
  ],
  other: [
    { title: 'Horario especial', message: 'Esta semana cambiamos el horario de atención. Consultanos.' },
    { title: 'Novedad', message: 'Tenemos novedades para vos: escribinos para conocerlas.' },
  ],
  repairs: [
    { title: 'Seguí tu reparación', message: 'Consultá el estado de tu equipo online con tu número de orden.' },
    { title: 'Horario del taller', message: 'Recibimos equipos de lunes a viernes de 8 a 18 h.' },
  ],
};

const clipText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function normalizeAnnouncement(value: unknown): Announcement {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawImages = Array.isArray(source.images)
    ? source.images
        .map((entry) => {
          const img = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
          return {
            url: clipText(img.url, 500),
            alt: clipText(img.alt, 120),
            href: clipText(img.href, 500),
          };
        })
        .filter((img) => Boolean(img.url))
        .slice(0, MAX_ANNOUNCEMENT_IMAGES)
    : [];
  const freq = source.frequency;
  const frequency: AnnouncementFrequency =
    freq === 'always' || freq === 'once_per_session' ? freq : 'once_per_day';
  const rawSec = source.autoCloseSeconds;
  const autoCloseSeconds =
    typeof rawSec === 'number' && Number.isFinite(rawSec)
      ? Math.max(0, Math.min(120, Math.round(rawSec)))
      : rawSec === 0
        ? 0
        : 5;
  const variant = source.badgeVariant;
  const validVariant = ANNOUNCEMENT_BADGE_VARIANTS.some((v) => v.value === variant)
    ? (variant as AnnouncementBadgeVariant)
    : 'primary';
  const rawAnim = source.carouselAnimation;
  const carouselAnimation: AnnouncementCarouselAnimation =
    rawAnim === 'fade' || rawAnim === 'zoom' ? rawAnim : 'slide';
  const rawCarouselSec = source.carouselIntervalSeconds;
  const carouselIntervalSeconds =
    typeof rawCarouselSec === 'number' && Number.isFinite(rawCarouselSec)
      ? Math.max(0, Math.min(30, Math.round(rawCarouselSec)))
      : rawCarouselSec === 0
        ? 0
        : 3;
  const rawBackdrop = source.imageBackdrop;
  const imageBackdrop: AnnouncementImageBackdrop =
    rawBackdrop === 'dark' || rawBackdrop === 'tinted' || rawBackdrop === 'light'
      ? rawBackdrop
      : 'ambient';
  const imageFit: AnnouncementImageFit = source.imageFit === 'cover' ? 'cover' : 'contain';
  const rawEffect = source.imageEffect;
  const imageEffect: AnnouncementImageEffect =
    rawEffect === 'glow' || rawEffect === 'none' ? rawEffect : 'zoom';

  return {
    id: clipText(source.id, 40),
    enabled: source.enabled === true,
    title: clipText(source.title, 120),
    message: clipText(source.message, 600),
    badgeLabel: clipText(source.badgeLabel ?? 'Novedad destacada', 40),
    badgeVariant: validVariant,
    highlightNote: clipText(source.highlightNote, 120),
    carouselAnimation,
    carouselIntervalSeconds,
    imageBackdrop,
    imageFit,
    imageEffect,
    frequency,
    autoCloseSeconds,
    imageUrl: clipText(source.imageUrl, 500),
    images: rawImages,
    ctaLabel: clipText(source.ctaLabel, 60),
    ctaHref: clipText(source.ctaHref, 500),
    startsAt: clipText(source.startsAt, 10),
    endsAt: clipText(source.endsAt, 10),
    updatedAt: clipText(source.updatedAt, 40),
  };
}

export function normalizeAnnouncementList(value: unknown, max = MAX_STORE_ANNOUNCEMENTS): Announcement[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];
  return entries
    .map((entry, index) => {
      const a = normalizeAnnouncement(entry);
      return a.id ? a : { ...a, id: `aviso-${index + 1}` };
    })
    .filter((a) => Boolean(a.title || a.message || a.images.length > 0))
    .slice(0, Math.max(1, max));
}

export function announcementDayStamp(now = new Date()): string {
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function announcementStatus(announcement: Announcement, now = new Date()): AnnouncementStatus {
  if (!announcement.enabled) return 'apagado';
  if (!announcement.title.trim() || !announcement.message.trim()) return 'incompleto';
  const today = announcementDayStamp(now);
  if (announcement.startsAt && today < announcement.startsAt) return 'programado';
  if (announcement.endsAt && today > announcement.endsAt) return 'vencido';
  return 'activo';
}

export function isAnnouncementLive(announcement: Announcement | null | undefined, now = new Date()): boolean {
  return announcement ? announcementStatus(announcement, now) === 'activo' : false;
}

export function announcementImages(announcement: Announcement | null | undefined): AnnouncementImage[] {
  if (!announcement) return [];
  if (announcement.images.length > 0) return announcement.images;
  return announcement.imageUrl ? [{ url: announcement.imageUrl, alt: '', href: '' }] : [];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function announcementIssues(announcement: Announcement): Record<string, string> {
  const issues: Record<string, string> = {};
  if (announcement.enabled && !announcement.title.trim()) {
    issues.title = 'Escribí un título para activar el aviso.';
  }
  if (announcement.enabled && !announcement.message.trim()) {
    issues.message = 'Escribí un mensaje para activar el aviso.';
  }
  if (announcement.ctaLabel.trim() && !announcement.ctaHref.trim()) {
    issues.ctaHref = 'El botón necesita un enlace (/ofertas o https://…).';
  }
  if (announcement.ctaHref.trim() && !isSafeLinkOrPath(announcement.ctaHref)) {
    issues.ctaHref = 'Usá una ruta de tu tienda (/ofertas) o una dirección http(s).';
  }
  if (announcement.startsAt && !DATE_RE.test(announcement.startsAt)) {
    issues.startsAt = 'Usá formato AAAA-MM-DD (ej. 2026-12-01).';
  }
  if (announcement.endsAt && !DATE_RE.test(announcement.endsAt)) {
    issues.endsAt = 'Usá formato AAAA-MM-DD (ej. 2026-12-31).';
  }
  if (
    announcement.startsAt &&
    announcement.endsAt &&
    DATE_RE.test(announcement.startsAt) &&
    DATE_RE.test(announcement.endsAt) &&
    announcement.startsAt > announcement.endsAt
  ) {
    issues.endsAt = 'La fecha de fin es anterior a la de inicio.';
  }
  return issues;
}

// ─── Galería de trabajos ───────────────────────────────────────────────────

export const MAX_GALLERY_IMAGES = 12;

export const DEFAULT_GALLERY_SECTION: GallerySectionSettings = {
  enabled: true,
  title: 'Nuestros trabajos',
  subtitle: 'Algunos de los cortes, trabajos y entregas que realizamos.',
  images: [],
};

export function galleryIssues(gallery: Partial<GallerySectionSettings>): Record<string, string> {
  const issues: Record<string, string> = {};
  if ((gallery.images?.length ?? 0) > MAX_GALLERY_IMAGES) {
    issues.images = `Máximo ${MAX_GALLERY_IMAGES} fotos permitidas.`;
  }
  return issues;
}

// ─── Cómo atendemos / Proceso ──────────────────────────────────────────────

export type ProcessStepTemplateId =
  | 'repairs'
  | 'purchase'
  | 'payments'
  | 'personalized'
  | 'fashion'
  | 'appointment'
  | 'food'
  | 'quote';

export const PROCESS_STEP_TEMPLATES: readonly {
  id: ProcessStepTemplateId;
  label: string;
  description: string;
  steps: { title: string; description: string }[];
}[] = [
  {
    id: 'repairs',
    label: 'Reparaciones',
    description: 'Diagnóstico, presupuesto, reparación y entrega.',
    steps: [
      { title: 'Diagnóstico', description: 'Revisamos el equipo e identificamos el problema.' },
      { title: 'Presupuesto', description: 'Te informamos el costo y el tiempo estimado.' },
      { title: 'Reparación', description: 'Realizamos el trabajo después de tu aprobación.' },
      { title: 'Entrega', description: 'Probamos el equipo y coordinamos la entrega.' },
    ],
  },
  {
    id: 'purchase',
    label: 'Compra y entrega',
    description: 'Selección, confirmación, preparación y recepción.',
    steps: [
      { title: 'Elegí tus productos', description: 'Explorá el catálogo y seleccioná lo que necesitás.' },
      { title: 'Confirmamos el pedido', description: 'Verificamos disponibilidad, pago y forma de entrega.' },
      { title: 'Preparamos la compra', description: 'Acondicionamos y revisamos los productos.' },
      { title: 'Retiro o delivery', description: 'Retirá en el local o recibí el pedido en tu zona.' },
    ],
  },
  {
    id: 'payments',
    label: 'Pagos y giros',
    description: 'Consulta, verificación, operación y comprobante.',
    steps: [
      { title: 'Consultá disponibilidad', description: 'Confirmamos el operador, requisitos y comisión.' },
      { title: 'Presentá los datos', description: 'Revisamos la información necesaria para la operación.' },
      { title: 'Realizamos la operación', description: 'Procesamos el pago, giro, retiro o depósito.' },
      { title: 'Recibí tu comprobante', description: 'Verificamos el resultado y entregamos la constancia.' },
    ],
  },
  {
    id: 'personalized',
    label: 'Atención personalizada',
    description: 'Consulta, propuesta y seguimiento.',
    steps: [
      { title: 'Contanos qué necesitás', description: 'Escuchamos tu consulta y reunimos la información clave.' },
      { title: 'Te proponemos una solución', description: 'Explicamos alternativas, costos y próximos pasos.' },
      { title: 'Acompañamos el resultado', description: 'Damos seguimiento hasta completar la atención.' },
    ],
  },
  {
    id: 'fashion',
    label: 'Compra de ropa',
    description: 'Elegí, consultá el talle, recibí y cambiá.',
    steps: [
      { title: 'Elegí tus prendas', description: 'Mirá la colección y guardá lo que te guste.' },
      { title: 'Consultá el talle', description: 'Te ayudamos a elegir el talle justo antes de pagar.' },
      { title: 'Pagá y recibí', description: 'Coordinamos el pago y el envío o retiro en el local.' },
      { title: 'Cambios sin vueltas', description: 'Si no te queda, lo cambiamos según nuestras condiciones.' },
    ],
  },
  {
    id: 'appointment',
    label: 'Turnos',
    description: 'Reservá, te confirmamos y te atendemos.',
    steps: [
      { title: 'Elegí servicio y horario', description: 'Reservá el turno que te quede mejor.' },
      { title: 'Te confirmamos', description: 'Recibís la confirmación con el día y la hora.' },
      { title: 'Te atendemos', description: 'Llegá unos minutos antes y disfrutá el servicio.' },
      { title: 'Volvé cuando quieras', description: 'Reservá tu próximo turno en un minuto.' },
    ],
  },
  {
    id: 'food',
    label: 'Pedidos y delivery',
    description: 'Pedí, lo preparamos y te lo llevamos.',
    steps: [
      { title: 'Hacé tu pedido', description: 'Elegí los productos y la forma de entrega.' },
      { title: 'Lo preparamos', description: 'Armamos tu pedido con productos frescos.' },
      { title: 'Delivery o retiro', description: 'Te lo llevamos o lo pasás a buscar listo.' },
    ],
  },
  {
    id: 'quote',
    label: 'Presupuesto y entrega',
    description: 'Contanos tu proyecto, te cotizamos y entregamos.',
    steps: [
      { title: 'Contanos tu proyecto', description: 'Enviá la lista de materiales o qué querés hacer.' },
      { title: 'Te cotizamos', description: 'Recibís precios y disponibilidad, sin compromiso.' },
      { title: 'Confirmás y pagás', description: 'Coordinamos el pago y la forma de entrega.' },
      { title: 'Retiro o envío a obra', description: 'Lo retirás en el local o lo llevamos a tu obra.' },
    ],
  },
];

export const PROCESS_TEMPLATES_BY_FAMILY: Record<GuidanceFamily, ProcessStepTemplateId[]> = {
  beauty_services: ['appointment', 'personalized'],
  general: ['purchase', 'personalized', 'payments'],
  clothing: ['fashion', 'purchase'],
  barbershop: ['appointment', 'personalized'],
  cosmetics: ['personalized', 'purchase', 'appointment'],
  electronics: ['purchase', 'personalized'],
  food: ['food', 'purchase'],
  hardware: ['quote', 'purchase'],
  other: ['personalized', 'purchase', 'payments'],
  repairs: ['repairs', 'purchase'],
};

export function createProcessStepsFromTemplate(templateId: ProcessStepTemplateId): ProcessStep[] {
  const template = PROCESS_STEP_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return [];
  return template.steps.map((step, index) => ({
    id: `${template.id}-step-${index + 1}`,
    number: index + 1,
    ...step,
  }));
}

export function getConfiguredProcessFlows(
  processFlows?: ProcessFlow[] | null,
  legacySteps?: ProcessStep[] | null,
): ProcessFlow[] {
  if (Array.isArray(processFlows) && processFlows.length > 0) return processFlows;
  if (Array.isArray(legacySteps) && legacySteps.length > 0) {
    return [
      {
        id: 'legacy-process',
        title: 'Proceso principal',
        description: 'Conocé cómo trabajamos paso a paso.',
        active: true,
        steps: legacySteps,
      },
    ];
  }
  return [
    {
      id: 'default-process',
      title: 'Cómo atendemos',
      description: 'Nuestro proceso paso a paso.',
      active: true,
      steps: createProcessStepsFromTemplate('purchase'),
    },
  ];
}

export function processFlowIssues(flows: readonly ProcessFlow[]): Record<string, string> {
  const issues: Record<string, string> = {};
  if (flows.length > 6) issues.flows = 'Máximo 6 procesos permitidos.';
  flows.forEach((flow, flowIndex) => {
    if (flow.title.trim().length < 2 || flow.title.trim().length > 80) {
      issues[`flow_${flowIndex}_title`] = `El proceso ${flowIndex + 1} necesita un título de 2 a 80 caracteres.`;
    }
    if (!flow.steps.length || flow.steps.length > 8) {
      issues[`flow_${flowIndex}_steps`] = `El proceso ${flowIndex + 1} debe tener entre 1 y 8 pasos.`;
    }
    flow.steps.forEach((step, stepIndex) => {
      if (step.title.trim().length < 2) {
        issues[`flow_${flowIndex}_step_${stepIndex}_title`] = `Paso ${stepIndex + 1}: título mínimo 2 caracteres.`;
      }
      if (step.description.trim().length < 5) {
        issues[`flow_${flowIndex}_step_${stepIndex}_desc`] = `Paso ${stepIndex + 1}: descripción mínima 5 caracteres.`;
      }
    });
  });
  return issues;
}

// ─── Catálogo de servicios ─────────────────────────────────────────────────

export const DEFAULT_SERVICES_SECTION: ServicesSectionSettings = {
  badge: 'Lo que hacemos',
  title: 'Nuestros servicios',
  subtitle: 'Servicios publicados por la empresa para consultas y atención directa.',
};

export const SERVICE_ICONS: readonly { value: ServiceIcon; label: string; ionicon: string }[] = [
  { value: 'smartphone', label: 'Celular', ionicon: 'phone-portrait-outline' },
  { value: 'monitor', label: 'Pantalla', ionicon: 'desktop-outline' },
  { value: 'battery', label: 'Batería', ionicon: 'battery-charging-outline' },
  { value: 'cpu', label: 'Sistema', ionicon: 'hardware-chip-outline' },
  { value: 'zap', label: 'Carga', ionicon: 'flash-outline' },
  { value: 'wrench', label: 'Reparación', ionicon: 'build-outline' },
  { value: 'shield', label: 'Garantía', ionicon: 'shield-checkmark-outline' },
  { value: 'package', label: 'Insumos', ionicon: 'cube-outline' },
  { value: 'headset', label: 'Soporte', ionicon: 'headset-outline' },
  { value: 'laptop', label: 'Laptop', ionicon: 'laptop-outline' },
  { value: 'clock', label: 'Tiempo', ionicon: 'time-outline' },
  { value: 'sparkles', label: 'Especial', ionicon: 'sparkles-outline' },
  { value: 'droplet', label: 'Cuidado', ionicon: 'water-outline' },
  { value: 'camera', label: 'Cámara', ionicon: 'camera-outline' },
  { value: 'microchip', label: 'Chip', ionicon: 'cog-outline' },
  { value: 'receipt', label: 'Facturas', ionicon: 'receipt-outline' },
  { value: 'wallet', label: 'Billetera', ionicon: 'wallet-outline' },
  { value: 'landmark', label: 'Banco', ionicon: 'business-outline' },
  { value: 'banknote', label: 'Efectivo', ionicon: 'cash-outline' },
  { value: 'credit-card', label: 'Tarjeta', ionicon: 'card-outline' },
];

export const SERVICE_COLORS: readonly { value: ServiceColor; label: string; hex: string; tint: string }[] = [
  { value: 'blue', label: 'Azul', hex: '#2563EB', tint: '#EFF6FF' },
  { value: 'green', label: 'Verde', hex: '#16A34A', tint: '#F0FDF4' },
  { value: 'purple', label: 'Púrpura', hex: '#9333EA', tint: '#FAF5FF' },
  { value: 'orange', label: 'Naranja', hex: '#EA580C', tint: '#FFF7ED' },
  { value: 'red', label: 'Rojo', hex: '#DC2626', tint: '#FEF2F2' },
  { value: 'indigo', label: 'Índigo', hex: '#4F46E5', tint: '#EEF2FF' },
  { value: 'teal', label: 'Teal', hex: '#0D9488', tint: '#F0FDFA' },
  { value: 'yellow', label: 'Amarillo', hex: '#CA8A04', tint: '#FEFCE8' },
  { value: 'cyan', label: 'Cian', hex: '#0891B2', tint: '#ECFEFF' },
  { value: 'pink', label: 'Rosa', hex: '#DB2777', tint: '#FDF2F8' },
  { value: 'rose', label: 'Fucsia', hex: '#E11D48', tint: '#FFF1F2' },
  { value: 'amber', label: 'Ámbar', hex: '#D97706', tint: '#FFFBEB' },
  { value: 'emerald', label: 'Esmeralda', hex: '#059669', tint: '#ECFDF5' },
  { value: 'sky', label: 'Celeste', hex: '#0284C7', tint: '#F0F9FF' },
];

export const SERVICE_PRESETS: readonly (Omit<ServiceItem, 'id'> & { verticalCategory: string })[] = [
  {
    verticalCategory: 'Tecnología',
    title: 'Cambio de pantalla y display',
    description: 'Reemplazo de módulo y pantalla con repuestos de calidad y calibración.',
    icon: 'monitor',
    color: 'blue',
    benefits: ['Repuestos testeados', 'Garantía escrita de 30 días', 'Calibración táctil'],
    active: true,
    price: 'Desde Gs. 150.000',
    priceNote: 'según modelo',
    duration: '45 a 90 min',
    category: 'Reparaciones',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Tecnología',
    title: 'Cambio de batería',
    description: 'Instalación de batería nueva con máxima salud y ciclos completos.',
    icon: 'battery',
    color: 'emerald',
    benefits: ['Baterías de alta capacidad', 'Garantía escrita', 'Instalación en el día'],
    active: true,
    price: 'Desde Gs. 90.000',
    priceNote: 'según marca',
    duration: '30 a 45 min',
    category: 'Reparaciones',
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Barbería',
    title: 'Corte de cabello',
    description: 'Corte a tijera o máquina, lavado y peinado según tu estilo.',
    icon: 'sparkles',
    color: 'indigo',
    benefits: ['Asesoramiento de estilo', 'Lavado incluido', 'Turno sin espera'],
    active: true,
    price: 'Gs. 50.000',
    priceNote: 'precio fijo',
    duration: '30 min',
    category: 'Barbería',
    featured: true,
    ctaUrl: '/turnos',
  },
  {
    verticalCategory: 'Barbería',
    title: 'Barba y perfilado',
    description: 'Arreglo de barba con navaja, toalla caliente y productos de cuidado.',
    icon: 'sparkles',
    color: 'amber',
    benefits: ['Toalla caliente', 'Perfilado a navaja', 'Aceites y bálsamos'],
    active: true,
    price: 'Gs. 35.000',
    priceNote: 'precio fijo',
    duration: '20 min',
    category: 'Barbería',
    ctaUrl: '/turnos',
  },
  {
    verticalCategory: 'Belleza',
    title: 'Manicura y esmaltado semipermanente',
    description: 'Limpieza, forma y esmaltado de larga duración con colores de temporada.',
    icon: 'sparkles',
    color: 'rose',
    benefits: ['Productos de calidad', 'Herramientas esterilizadas', 'Dura hasta 3 semanas'],
    active: true,
    price: 'Gs. 80.000',
    priceNote: 'por sesión',
    duration: '60 min',
    category: 'Belleza & Cuidado',
    ctaUrl: '/turnos',
  },
  {
    verticalCategory: 'Belleza',
    title: 'Tratamiento facial y skincare',
    description: 'Limpieza profunda, hidratación y cuidado facial con productos profesionales.',
    icon: 'droplet',
    color: 'pink',
    benefits: ['Productos dermatológicos', 'Evaluación de piel', 'Resultados inmediatos'],
    active: true,
    price: 'Gs. 120.000',
    priceNote: 'por sesión',
    duration: '60 min',
    category: 'Belleza & Cuidado',
    featured: true,
    ctaUrl: '/turnos',
  },
];

export const SERVICES_SECTION_IDEAS: Record<GuidanceFamily, { label: string; badge: string; title: string; subtitle: string }[]> = {
  beauty_services: [{ label: 'Estética', badge: 'Servicios', title: 'Servicios pensados para vos', subtitle: 'Conocé lo que hacemos, compará opciones y coordiná por WhatsApp.' }],
  general: [{ label: 'General', badge: 'Servicios', title: 'Servicios pensados para vos', subtitle: 'Conocé lo que hacemos, compará opciones y coordiná por WhatsApp.' }],
  other: [{ label: 'General', badge: 'Servicios', title: 'Servicios pensados para vos', subtitle: 'Conocé lo que hacemos, compará opciones y coordiná por WhatsApp.' }],
  clothing: [{ label: 'Arreglos a medida', badge: 'Arreglos a medida', title: 'Tu ropa, a tu medida', subtitle: 'Ajustes, dobladillos y prendas a pedido con terminaciones prolijas.' }],
  barbershop: [
    { label: 'Barbería', badge: 'Cortes & barba', title: 'Tu estilo, en buenas manos', subtitle: 'Cortes, barba y perfilado con turno. Reservá en un minuto.' },
    { label: 'Peluquería', badge: 'Peluquería', title: 'Cortes, color y peinados', subtitle: 'Profesionales con experiencia. Reservá tu turno online.' },
  ],
  cosmetics: [{ label: 'Estética', badge: 'Estética & cuidado', title: 'Tratamientos para cuidarte', subtitle: 'Faciales, manos y asesoramiento con productos profesionales.' }],
  electronics: [{ label: 'Soporte técnico', badge: 'Soporte técnico', title: 'Instalación y soporte para tus equipos', subtitle: 'Configuración, mantenimiento y asesoramiento con técnicos de confianza.' }],
  food: [{ label: 'Encargos', badge: 'Por encargo', title: 'Encargos y catering para eventos', subtitle: 'Tortas, bandejas y menús. Pedí con anticipación.' }],
  hardware: [{ label: 'Instalaciones', badge: 'Instalaciones', title: 'Instalaciones y trabajos en tu obra', subtitle: 'Electricidad, plomería y montaje con personal calificado.' }],
  repairs: [
    { label: 'Taller', badge: 'Servicio técnico', title: 'Reparamos tu equipo con garantía', subtitle: 'Diagnóstico profesional, repuestos y seguimiento online.' },
    { label: 'Express', badge: 'Servicio express', title: 'Mantenimiento en el día', subtitle: 'Cuidamos tus equipos con entregas rápidas.' },
  ],
};

const SPECIALTY_SUGGESTION_EXAMPLES: Record<ServiceSpecialty, string[]> = {
  barbering: ['Corte de cabello', 'Perfilado de barba'],
  hair: ['Peinado', 'Coloración'],
  nails: ['Manicura', 'Pedicura'],
  lashes: ['Extensiones de pestañas', 'Lifting de pestañas'],
  brows: ['Diseño de cejas', 'Laminado de cejas'],
  makeup: ['Maquillaje social', 'Maquillaje para eventos'],
  aesthetics: ['Limpieza facial', 'Cuidado facial'],
  other: [],
};

export function getServiceSpecialtySuggestions(
  specialties: readonly (ServiceSpecialty | (string & {}))[],
) {
  return [...new Set(specialties)].flatMap((s) =>
    (SPECIALTY_SUGGESTION_EXAMPLES[s as ServiceSpecialty] ?? []).map((title) => ({
      title,
      category: SERVICE_SPECIALTY_LABELS[s as ServiceSpecialty] ?? String(s),
    })),
  );
}

export function serviceIssues(service: Partial<ServiceItem>): Record<string, string> {
  const issues: Record<string, string> = {};
  const title = (service.title ?? '').trim();
  const desc = (service.description ?? '').trim();
  if (title.length < 3 || title.length > 100) issues.title = 'El título debe tener entre 3 y 100 caracteres.';
  if (desc.length < 10 || desc.length > 500) issues.description = 'La descripción debe tener entre 10 y 500 caracteres.';
  const validBenefits = (service.benefits ?? []).filter((b) => b.trim().length > 0);
  if (validBenefits.length === 0) issues.benefits = 'Agregá al menos 1 beneficio o detalle incluido.';
  else if (validBenefits.length > 10) issues.benefits = 'Máximo 10 beneficios.';
  if (service.ctaUrl && !isSafeLinkOrPath(service.ctaUrl)) {
    issues.ctaUrl = 'Usá una ruta interna (/turnos) o una dirección http(s).';
  }
  return issues;
}

// ─── Asistente interno (sin LLM, costo cero) ───────────────────────────────

export type AssistantTone = 'cercano' | 'profesional' | 'premium' | 'juvenil';

export type WebsiteSuggestion = {
  hero: { badge: string; title: string; subtitle: string; ctaPrimaryText: string; ctaSecondaryText: string };
  slogan: string;
  description: string;
  trustBar: { icon: string; title: string; description: string }[];
  tips: { section: WebsiteSectionId; advice: string }[];
};

const ASSISTANT_COPY: Record<GuidanceFamily, { noun: string; badges: string[]; titles: string[]; offer: string; slogans: string[]; benefits: [string, string, string][] }> = {
  beauty_services: { noun: 'un negocio de belleza y cuidado personal', badges: ['Servicios de belleza'], titles: ['Un momento para cuidarte'], offer: 'servicios de belleza y cuidado personal', slogans: ['Elegí el servicio que buscás'], benefits: [['message', 'Consultá los servicios', 'Conocé nuestras opciones de atención']] },
  barbershop: { noun: 'una barbería', badges: ['Reservá tu turno online', 'Cortes y barba', 'Turnos sin esperas'], titles: ['Tu mejor corte, sin esperas', 'Estilo que se nota', 'Cortes, barba y estilo en un solo lugar'], offer: 'cortes, perfilado de barba y estilo', slogans: ['Tu estilo, nuestro oficio', 'Cortes con detalle', 'Salí renovado'], benefits: [['clock', 'Reservá online', 'Elegí día, horario y profesional'], ['star', 'Atención con detalle', 'Cada corte a tu medida'], ['message', 'Te avisamos', 'Recordatorio de tu turno']] },
  clothing: { noun: 'una tienda de ropa', badges: ['Nueva temporada', 'Moda para todos los días', 'Colección disponible'], titles: ['Encontrá tu próximo look', 'Moda que va con vos', 'Prendas para cada momento'], offer: 'prendas y accesorios', slogans: ['Vestite a tu manera', 'Tu estilo empieza acá', 'Moda simple y cómoda'], benefits: [['message', 'Te asesoramos', 'Consultá talles por WhatsApp'], ['package', 'Stock actualizado', 'Lo que ves está disponible'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']] },
  cosmetics: { noun: 'una tienda de cosmética', badges: ['Belleza y cuidado', 'Productos seleccionados', 'Novedades en belleza'], titles: ['Todo para tu rutina de belleza', 'Cuidate con lo mejor', 'Belleza que se siente'], offer: 'cosmética, cuidado de la piel y maquillaje', slogans: ['Tu belleza, tu momento', 'Cuidado que se nota', 'Brillá a tu manera'], benefits: [['award', 'Productos originales', 'Marcas de confianza'], ['handshake', 'Asesoramiento', 'Te ayudamos a elegir'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']] },
  electronics: { noun: 'una tienda de tecnología', badges: ['Tecnología al día', 'Equipos y accesorios', 'Lo último en tecnología'], titles: ['La tecnología que necesitás', 'Equipos y accesorios al mejor precio', 'Conectate con lo último'], offer: 'celulares, accesorios y tecnología', slogans: ['Tecnología a tu alcance', 'Conectado con vos', 'Lo último, cerca tuyo'], benefits: [['shield', 'Compra segura', 'Productos revisados'], ['message', 'Soporte por WhatsApp', 'Respondemos tus dudas'], ['package', 'Stock disponible', 'Entrega inmediata en tienda']] },
  food: { noun: 'un comercio de alimentos', badges: ['Fresco todos los días', 'Pedí online', 'Sabor de casa'], titles: ['Lo de todos los días, más cerca', 'Productos frescos para tu mesa', 'Hacé tu pedido sin salir de casa'], offer: 'alimentos y productos frescos', slogans: ['Calidad que se saborea', 'Fresco y cerca', 'Todo para tu mesa'], benefits: [['zap', 'Pedido rápido', 'Armá tu compra en minutos'], ['star', 'Productos frescos', 'Seleccionados cada día'], ['message', 'Atención directa', 'Consultanos por WhatsApp']] },
  hardware: { noun: 'una ferretería', badges: ['Todo para tu obra', 'Herramientas y materiales', 'Stock disponible'], titles: ['Todo para tus proyectos', 'Herramientas y materiales en un solo lugar', 'Lo que tu obra necesita'], offer: 'herramientas, materiales y accesorios', slogans: ['Construí con confianza', 'La herramienta justa', 'Todo para tu obra'], benefits: [['package', 'Amplio stock', 'Lo que buscás, disponible'], ['handshake', 'Asesoramiento', 'Te ayudamos a elegir'], ['map-pin', 'Retiro en local', 'Pasá a buscar tu pedido']] },
  repairs: { noun: 'un servicio técnico', badges: ['Servicio técnico', 'Diagnóstico y reparación', 'Reparaciones con garantía'], titles: ['Reparamos tu equipo', 'Tu equipo en buenas manos', 'Diagnóstico claro, reparación confiable'], offer: 'diagnóstico y reparación de equipos', slogans: ['Reparamos con cuidado', 'Tu equipo, como nuevo', 'Soluciones que duran'], benefits: [['wrench', 'Técnicos con experiencia', 'Diagnóstico claro'], ['clock', 'Seguimiento online', 'Mirá el estado de tu equipo'], ['message', 'Te mantenemos al tanto', 'Avisos por WhatsApp']] },
  general: { noun: 'un comercio', badges: ['Comprá online', 'Novedades', 'Atención personalizada'], titles: ['Lo que buscás, en un solo lugar', 'Comprá fácil y rápido', 'Todo lo que necesitás, cerca tuyo'], offer: 'productos para el día a día', slogans: ['Cerca tuyo, siempre', 'Comprá fácil', 'Calidad y buena atención'], benefits: [['message', 'Atención directa', 'Consultanos por WhatsApp'], ['package', 'Stock actualizado', 'Lo que ves está disponible'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']] },
  other: { noun: 'un negocio', badges: ['Bienvenido', 'Atención personalizada', 'Conocenos'], titles: ['Lo que buscás, en un solo lugar', 'Atención que marca la diferencia', 'Conocé lo que hacemos'], offer: 'productos y servicios', slogans: ['Cerca tuyo, siempre', 'Hecho con dedicación', 'Calidad y buena atención'], benefits: [['message', 'Atención directa', 'Consultanos por WhatsApp'], ['handshake', 'Trato cercano', 'Te acompañamos en tu compra'], ['star', 'Calidad', 'Lo hacemos con dedicación']] },
};

const MENTIONED_BENEFITS: [RegExp, string, string, string][] = [
  [/\b(delivery|env[ií]o|enviamos|a domicilio)/i, 'truck', 'Envíos a domicilio', 'Recibí tu pedido en casa'],
  [/\b(cuotas|tarjeta|transferencia|qr)/i, 'credit-card', 'Varias formas de pago', 'Pagá como te quede cómodo'],
  [/\bgarant[ií]a/i, 'shield', 'Con garantía', 'Comprá con tranquilidad'],
  [/\b(turno|reserva|cita|agenda)/i, 'clock', 'Reservá online', 'Elegí el horario que te quede bien'],
  [/\b(original|oficial|importad)/i, 'award', 'Productos originales', 'Marcas de confianza'],
  [/\b(r[aá]pido|express|mismo d[ií]a|al instante)/i, 'zap', 'Atención rápida', 'Sin largas esperas'],
  [/\b(retiro|sucursal|local)\b/i, 'map-pin', 'Retiro en el local', 'Pasá cuando quieras'],
];

const ASSISTANT_TONES: Record<AssistantTone, { closing: string[]; secondary: string }> = {
  cercano: { closing: ['Te esperamos.', 'Escribinos cuando quieras.', 'Vení a conocernos.'], secondary: 'Escribinos' },
  profesional: { closing: ['Atención seria y responsable.', 'Calidad en cada trabajo.', 'Estamos para ayudarte.'], secondary: 'Contactar' },
  premium: { closing: ['Una experiencia cuidada en cada detalle.', 'Calidad sin concesiones.', 'Lo mejor para vos.'], secondary: 'Conocer más' },
  juvenil: { closing: ['¡Pasá y mirá todo lo nuevo!', 'Sumate a la movida.', 'Te va a encantar.'], secondary: 'Hablemos' },
};

const TIP_ADVICE: Record<WebsiteSectionId, string> = {
  company: 'Completá logo y WhatsApp: es lo primero que mira un cliente nuevo.',
  appearance: 'Elegí la plantilla que mejor vaya con tu rubro y tu color de marca.',
  checkout: 'Definí cómo te compran (carrito o WhatsApp) y activá pagos y entrega.',
  hero: 'Aplicá la portada sugerida y revisá el botón principal.',
  trust_bar: 'Mostrá 3 beneficios reales para generar confianza.',
  brands: 'Si vendés marcas conocidas, mostralas en el inicio.',
  carousel: 'Subí un banner con tu mejor promoción.',
  offers: 'Cargá precios de oferta en el catálogo para verlos en Ofertas.',
  announcement: 'Usá un aviso para horarios especiales o promos flash.',
  booking: 'Activá las reservas para recibir turnos sin mensajear.',
  gallery: 'Subí fotos reales de tus trabajos.',
  services: 'Cargá tus servicios con precio y duración.',
  process: 'Contá paso a paso cómo atendés.',
};

export function generateMobileWebsiteSuggestion(input: {
  about: string;
  tone: AssistantTone;
  variant: number;
  name: string;
  vertical: BusinessVertical;
  focus: WebsiteFocus;
  services: string[];
  bookingAvailable: boolean;
  commerceMode: CommerceMode;
  pending: { section: WebsiteSectionId }[];
}): WebsiteSuggestion {
  const copy =
    input.focus === 'repairs' ? ASSISTANT_COPY.repairs : ASSISTANT_COPY[input.vertical] ?? ASSISTANT_COPY.general;
  let hash = 0;
  for (let i = 0; i < input.about.length; i += 1) hash = (hash * 31 + input.about.charCodeAt(i)) | 0;
  const seed = Math.abs(hash) + input.variant;
  const pick = <T,>(arr: readonly T[], offset = 0) => arr[(seed + offset) % arr.length];

  const placeMatch = input.about.match(
    /\ben\s+((?:San|Santa|Villa|Puerto|Ciudad del)\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/,
  );
  const place = placeMatch ? `${placeMatch[1] ?? ''}${placeMatch[2]}`.trim() : null;

  const offMatch = input.about.match(
    /\b(?:hacemos|ofrecemos|vendemos|trabajamos con|tenemos|reparamos|especialistas en)\s+([^.;:\n]+)/i,
  );
  const offerings = offMatch
    ? offMatch[1]
        .split(/,|\s+y\s+|\s+e\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 1 && p.length < 50)
        .slice(0, 5)
    : [];

  const joinList = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  const offered = offerings.length
    ? joinList(offerings)
    : input.services.length
      ? joinList(input.services.slice(0, 4).map((s) => s.toLowerCase()))
      : copy.offer;

  const tone = ASSISTANT_TONES[input.tone];
  const primary =
    input.bookingAvailable || input.focus === 'services'
      ? 'Reservar turno'
      : input.focus === 'repairs'
        ? 'Ver servicios'
        : input.commerceMode === 'whatsapp'
          ? 'Ver productos'
          : 'Comprar ahora';

  const clip = (v: string, max: number) => v.replace(/\s+/g, ' ').trim().slice(0, max);
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  const intro = input.name
    ? `${input.name} es ${copy.noun}${place ? ` en ${place}` : ''}.`
    : `Somos ${copy.noun}${place ? ` en ${place}` : ''}.`;
  const how =
    input.bookingAvailable || input.focus === 'services'
      ? 'Reservá tu turno online eligiendo día y horario.'
      : input.commerceMode === 'whatsapp'
        ? 'Mirá el catálogo y hacé tu pedido por WhatsApp.'
        : input.focus === 'repairs'
          ? 'Traé tu equipo y seguí el estado desde la web.'
          : 'Elegí tus productos y hacé tu pedido online.';

  const mentioned = MENTIONED_BENEFITS.filter(([pat]) => pat.test(input.about)).map(
    ([, icon, title, description]) => ({ icon, title, description }),
  );
  const trustBar: { icon: string; title: string; description: string }[] = [];
  for (const item of [...mentioned, ...copy.benefits.map(([icon, title, description]) => ({ icon, title, description }))]) {
    if (trustBar.length >= 4) break;
    if (trustBar.some((t) => t.icon === item.icon || t.title === item.title)) continue;
    trustBar.push({ icon: item.icon, title: clip(item.title, 40), description: clip(item.description, 90) });
  }

  const tips = input.pending
    .filter((s, idx, all) => all.findIndex((o) => o.section === s.section) === idx)
    .slice(0, 3)
    .map((s) => ({ section: s.section, advice: TIP_ADVICE[s.section] }));

  return {
    hero: {
      badge: clip(place && input.variant % 2 === 1 ? `${pick(copy.badges)} · ${place}` : pick(copy.badges), 40),
      title: clip(pick(copy.titles), 90),
      subtitle: clip(`${cap(offered)}${place ? ` en ${place}` : ''}. ${pick(tone.closing, 1)}`, 220),
      ctaPrimaryText: primary,
      ctaSecondaryText: tone.secondary,
    },
    slogan: clip(pick(copy.slogans, 3), 90),
    description: clip(`${intro} Ofrecemos ${offered}. ${how} ${pick(tone.closing, 2)}`, 600),
    trustBar,
    tips,
  };
}
