import { readPrimaryActivity, type PrimaryActivity } from '../../../src/lib/organization/primary-activity';
/**
 * «Configuración» del comercio en la app: los MISMOS datos que /admin/settings
 * en la web (system_settings + organization_settings del comercio activo).
 * Lógica pura, sin React Native, para poder probarla.
 */
import {
  BUSINESS_VERTICAL_LABELS,
  OPERATING_MODEL_LABELS,
} from '../../../src/lib/organization/business-labels';
import { convertWithRounding } from '../../../src/lib/products/foreign-price';
import {
  REGIONAL_CURRENCIES,
  formatCurrencyAmount,
  getCurrencyFractionDigits,
  getRegionalCurrencySymbol,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeLocaleCode,
  normalizeTimeZone,
  resolveEffectiveLocale,
  type CountryCode,
  type LocaleCode,
} from '../../../src/lib/regional/contract';
import { needsCountryConfirmation } from '../../../src/lib/regional/settings';
import {
  moduleDisplayHint,
  moduleDisplayName,
} from '../../../src/lib/saas/plan-feature-catalog';

// ─── Configuración del comercio ────────────────────────────────────────────

export type OrgSettings = {
  companyName: string;
  companyRuc: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  city: string;
  currency: string;
  taxRate: number;
  timeZone: string;
  language: string;
  countryCode: CountryCode | null;
  locale: LocaleCode | null;
  needsCountryConfirmation: boolean;
};

export type OrgSettingsField = Exclude<keyof OrgSettings, 'needsCountryConfirmation'>;

export const CURRENCIES: readonly { code: string; name: string; symbol: string }[] = REGIONAL_CURRENCIES.map((currency) => ({
  code: currency.code,
  name: currency.name,
  symbol: getRegionalCurrencySymbol(currency.code, 'es-PY'),
}));

/** «Idioma» en la web: hoy cambia el formato de números y fechas, no los textos. */
export const LANGUAGES: readonly { code: string; name: string; locale: string }[] = [
  { code: 'es', name: 'Español', locale: 'es-PY' },
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'pt', name: 'Português', locale: 'pt-BR' },
];

/** Las mismas 16 zonas horarias que ofrece la web (`admin-settings.ts`). */
export const TIME_ZONES: readonly { code: string; name: string }[] = [
  { code: 'America/Asuncion', name: 'Asunción, Paraguay' },
  { code: 'America/Argentina/Buenos_Aires', name: 'Buenos Aires, Argentina' },
  { code: 'America/Sao_Paulo', name: 'São Paulo, Brasil' },
  { code: 'America/Santiago', name: 'Santiago, Chile' },
  { code: 'America/Montevideo', name: 'Montevideo, Uruguay' },
  { code: 'America/La_Paz', name: 'La Paz, Bolivia' },
  { code: 'America/Lima', name: 'Lima, Perú' },
  { code: 'America/Bogota', name: 'Bogotá, Colombia' },
  { code: 'America/Mexico_City', name: 'Ciudad de México, México' },
  { code: 'America/New_York', name: 'Nueva York (este), Estados Unidos' },
  { code: 'America/Chicago', name: 'Chicago (centro), Estados Unidos' },
  { code: 'America/Denver', name: 'Denver (montaña), Estados Unidos' },
  { code: 'America/Los_Angeles', name: 'Los Ángeles (pacífico), Estados Unidos' },
  { code: 'America/Anchorage', name: 'Anchorage (Alaska), Estados Unidos' },
  { code: 'Pacific/Honolulu', name: 'Honolulu (Hawái), Estados Unidos' },
  { code: 'UTC', name: 'UTC' },
];

const isKnown = (list: readonly { code: string }[], value: unknown): value is string =>
  typeof value === 'string' && list.some((item) => item.code === value);

export function isValidTimeZoneCode(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  return isKnown(TIME_ZONES, value) || normalizeTimeZone(value) !== null;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * /api/settings/shared responde una fila con nombres de base de datos
 * (company_name, tax_rate…). Se lleva a los nombres que acepta el PUT.
 */
export function fromSharedRow(row: Record<string, unknown> | null | undefined): OrgSettings {
  const data = row ?? {};
  const tax = typeof data.tax_rate === 'string' ? Number.parseFloat(data.tax_rate) : Number(data.tax_rate);
  const countryCode = normalizeCountryCode(data.country_code);
  return {
    companyName: text(data.company_name),
    companyRuc: text(data.company_ruc),
    companyEmail: text(data.company_email),
    companyPhone: text(data.company_phone),
    companyAddress: text(data.company_address),
    city: text(data.city),
    currency: isKnown(CURRENCIES, data.currency) ? data.currency : 'PYG',
    taxRate: Number.isFinite(tax) ? tax : 10,
    timeZone: typeof data.time_zone === 'string' && data.time_zone ? data.time_zone : 'America/Asuncion',
    language: isKnown(LANGUAGES, data.language) ? data.language : 'es',
    countryCode,
    locale: normalizeLocaleCode(data.locale),
    needsCountryConfirmation: needsCountryConfirmation(countryCode),
  };
}

const TEXT_FIELDS: readonly OrgSettingsField[] = ['companyName', 'companyRuc', 'companyEmail', 'companyPhone', 'companyAddress', 'city'];

/**
 * Solo lo que cambió, como hace la web: el servidor mezcla con lo guardado, así
 * que un campo que no se tocó no viaja y no puede pisar nada.
 */
export function changedSettings(saved: OrgSettings, draft: OrgSettings): Partial<OrgSettings> {
  const changes: Partial<OrgSettings> = {};
  for (const key of Object.keys(draft) as (keyof OrgSettings)[]) {
    if (key === 'needsCountryConfirmation') continue;
    const field = key as OrgSettingsField;
    const next = TEXT_FIELDS.includes(field) ? String(draft[field]).trim() : draft[field];
    const previous = TEXT_FIELDS.includes(field) ? String(saved[field]).trim() : saved[field];
    if (next !== previous) (changes as Record<string, unknown>)[field] = next;
  }
  return changes;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Las mismas reglas que valida el servidor, con mensajes para la persona. */
export function settingsIssues(draft: OrgSettings): Partial<Record<OrgSettingsField, string>> {
  const issues: Partial<Record<OrgSettingsField, string>> = {};
  const name = draft.companyName.trim();
  if (!name) issues.companyName = 'El nombre del comercio es obligatorio.';
  else if (name.length > 100) issues.companyName = 'El nombre no puede superar 100 caracteres.';
  const email = draft.companyEmail.trim();
  if (email && !EMAIL.test(email)) issues.companyEmail = 'Revisá el email: parece incompleto.';
  if (draft.companyPhone.trim().length > 50) issues.companyPhone = 'El teléfono no puede superar 50 caracteres.';
  if (draft.companyRuc.trim().length > 50) issues.companyRuc = 'El identificador fiscal no puede superar 50 caracteres.';
  if (draft.companyAddress.trim().length > 500) issues.companyAddress = 'La dirección no puede superar 500 caracteres.';
  if (draft.city.trim().length > 100) issues.city = 'La ciudad no puede superar 100 caracteres.';
  if (!Number.isFinite(draft.taxRate)) issues.taxRate = 'Ingresá el IVA en números, por ejemplo 10.';
  else if (draft.taxRate < 0 || draft.taxRate > 100) issues.taxRate = 'El IVA tiene que estar entre 0 y 100 %.';
  if (!isValidTimeZoneCode(draft.timeZone)) issues.timeZone = 'Elegí una zona horaria válida de la lista.';
  return issues;
}

export const currencyName = (code: string) => CURRENCIES.find((item) => item.code === code)?.name ?? code;
export const currencySymbol = (code: string) => {
  const normalized = normalizeCurrencyCode(code);
  return normalized ? getRegionalCurrencySymbol(normalized, 'es-PY') : code;
};
export const timeZoneName = (code: string) =>
  TIME_ZONES.find((item) => item.code === code)?.name ?? (code ? code.replace(/_/g, ' ') : '');
export const languageName = (code: string) => LANGUAGES.find((item) => item.code === code)?.name ?? code;

export function fiscalIdLabel(countryCode: CountryCode | string | null | undefined): string {
  switch (countryCode) {
    case 'PY':
      return 'RUC';
    case 'AR':
      return 'CUIT / CUIL';
    case 'BR':
      return 'CNPJ / CPF';
    case 'US':
      return 'EIN / Tax ID';
    default:
      return 'RUC o identificación fiscal';
  }
}

export function fiscalIdPlaceholder(countryCode: CountryCode | string | null | undefined): string {
  switch (countryCode) {
    case 'PY':
      return '80012345-6';
    case 'AR':
      return '20-12345678-9';
    case 'BR':
      return '12.345.678/0001-90';
    case 'US':
      return '12-3456789';
    default:
      return '80012345-6';
  }
}

export function formatPricePreview(input: {
  currency: string;
  language?: string | null;
  countryCode?: CountryCode | string | null;
  locale?: LocaleCode | string | null;
}, amount = 1234567.89): string {
  const currency = normalizeCurrencyCode(input.currency) ?? 'PYG';
  const effectiveLocale = resolveEffectiveLocale({
    locale: input.locale,
    countryCode: input.countryCode,
    language: input.language,
  });
  try {
    return formatCurrencyAmount(amount, currency, effectiveLocale);
  } catch {
    return `${currencySymbol(currency)} ${formatNumber(amount, getCurrencyFractionDigits(currency))}`;
  }
}

// ─── Números escritos por la persona ───────────────────────────────────────

/**
 * Acepta cómo se escribe en Paraguay: «7.300» es siete mil trescientos y
 * «7,5» es siete y medio. Con un solo punto y no en grupos de tres
 * («1.25») se toma como decimal. Devuelve NaN si no es un número.
 */
export function parseDecimal(input: string): number {
  const value = input.trim().replace(/\s/g, '');
  if (!value) return Number.NaN;
  let normalized: string;
  if (value.includes(',')) normalized = value.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) normalized = value.replace(/\./g, '');
  else normalized = value;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Número con separador de miles «.» y coma decimal, como lo lee la persona. */
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}${grouped}${fraction && Number(fraction) !== 0 ? `,${fraction.replace(/0+$/, '')}` : ''}`;
}

/**
 * Formatea tipos de cambio conservando decimales en monedas sub-unitarias
 * (por ejemplo `1 PYG = US$ 0,000137` cuando la empresa opera en USD).
 */
export function formatRateNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return formatNumber(value, 0);
  const abs = Math.abs(value);
  if (abs >= 1) return formatNumber(value, 4);
  if (abs >= 0.00001) return formatNumber(value, 6);
  return formatNumber(value, 8);
}

// ─── Tipos de cambio ───────────────────────────────────────────────────────

export type ExchangeRate = { currency: string; rate: number; rounding: number; updated_at?: string | null };

export type ExchangeRateHistory = {
  id: string;
  currency: string;
  previous_rate: number | null;
  rate: number;
  products_updated: number;
  created_at: string;
};

export type ExchangeRatesState = {
  /** false si la base todavía no tiene la tabla de tipos de cambio. */
  available: boolean;
  canEdit: boolean;
  localCurrency: string;
  rates: ExchangeRate[];
  history: ExchangeRateHistory[];
  /** Cuántos productos tienen el precio cargado en cada moneda. */
  usage: Record<string, number>;
};

/** Los redondeos que acepta el servidor para el precio en moneda local. */
export const ROUNDINGS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Sin redondeo' },
  { value: 10, label: 'A 10' },
  { value: 50, label: 'A 50' },
  { value: 100, label: 'A 100' },
  { value: 500, label: 'A 500' },
  { value: 1000, label: 'A 1.000' },
  { value: 0.01, label: 'Centavos' },
];

export function rateIssue(rate: number): string | null {
  if (!Number.isFinite(rate)) return 'Ingresá el tipo de cambio en números, por ejemplo 7.300.';
  if (rate <= 0) return 'El tipo de cambio tiene que ser mayor a cero.';
  if (rate > 1_000_000_000) return 'El tipo de cambio es demasiado grande.';
  return null;
}

/** Monedas que se pueden agregar: ni la local ni las que ya tienen tipo de cambio. */
export function addableCurrencies(state: Pick<ExchangeRatesState, 'localCurrency' | 'rates'>): string[] {
  const used = new Set(state.rates.map((rate) => rate.currency));
  return CURRENCIES.map((item) => item.code).filter((code) => code !== state.localCurrency && !used.has(code));
}

/** Cómo se ve el tipo de cambio: «1 USD = ₲ 7.300» o «1 PYG = US$ 0,000137». */
export function describeRate(rate: Pick<ExchangeRate, 'currency' | 'rate'>, localCurrency: string): string {
  return `1 ${rate.currency} = ${currencySymbol(localCurrency)} ${formatRateNumber(rate.rate)}`;
}

export function convertSampleAmount(
  foreignAmount: number,
  rate: number,
  rounding: number,
  localCurrency: string,
): string {
  const converted = convertWithRounding(foreignAmount, rate, rounding);
  const decimals = rounding < 1 ? 2 : getCurrencyFractionDigits(localCurrency);
  return `${currencySymbol(localCurrency)} ${formatNumber(converted, decimals)}`;
}

// ─── Estado de armado del negocio (paridad con SettingsSetupCard web) ───────

export type SettingsSetupStatus = {
  onboardingStatus: 'completed' | 'in_progress' | 'not_started';
  branch: { name: string; city: string } | null;
  storefront: { public: boolean; slug: string | null };
  logo: boolean | null;
  payments: boolean | null;
  products: boolean | null;
  hasBusinessData: boolean;
};

export type SetupChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  route: string;
};

export function buildMobileSetupItems(
  saved: OrgSettings,
  status: SettingsSetupStatus | null,
): SetupChecklistItem[] {
  const items: SetupChecklistItem[] = [
    { key: 'country', label: 'Confirmá el país', done: Boolean(saved.countryCode), route: '/admin/settings/regional' },
    { key: 'phone', label: 'Teléfono de contacto', done: Boolean(saved.companyPhone.trim()), route: '/admin/settings/company' },
    { key: 'address', label: 'Dirección y ciudad', done: Boolean(saved.companyAddress.trim() && saved.city.trim()), route: '/admin/settings/company' },
    { key: 'email', label: 'Email del negocio', done: Boolean(saved.companyEmail.trim()), route: '/admin/settings/company' },
    {
      key: 'ruc',
      label: saved.countryCode === 'PY' ? 'RUC para tus comprobantes' : `${fiscalIdLabel(saved.countryCode)} para comprobantes`,
      done: Boolean(saved.companyRuc.trim()),
      route: '/admin/settings/company',
    },
  ];
  if (status) {
    if (status.logo !== null) items.push({ key: 'logo', label: 'Subí tu logo', done: status.logo, route: '/admin/website/appearance' });
    if (status.products !== null) items.push({ key: 'product', label: 'Cargá tu primer producto', done: status.products, route: '/panel/products/form' });
    if (status.payments !== null) items.push({ key: 'payments', label: 'Elegí cómo te pagan en la tienda', done: status.payments, route: '/admin/website/checkout' });
    items.push({ key: 'storefront', label: 'Publicá tu tienda online', done: status.storefront.public, route: '/admin/website/domain' });
  }
  return items;
}

// ─── Política de 2FA para administradores ───────────────────────────────────

export type AdminMfaPolicy = {
  requireAdminMfa: boolean;
  canChange: boolean;
};

// ─── Perfil del negocio (reglas alineadas con business-profile.ts) ─────────

export const BUSINESS_VERTICALS = [
  'general',
  'clothing',
  'cosmetics',
  'electronics',
  'food',
  'hardware',
  'barbershop',
  'beauty_services',
  'other',
] as const;

export const OPERATING_MODELS = ['retail', 'wholesale', 'service', 'repair', 'mixed'] as const;

export const ORGANIZATION_MODULES = [
  'inventory',
  'inventory_admin',
  'pos',
  'crm',
  'orders',
  'ecommerce',
  'repairs',
  'services',
  'credits',
  'delivery',
  'analytics',
  'web_analytics',
  'promotions',
  'security',
  'finances',
  'reports',
] as const;

export const SERVICE_SPECIALTIES = [
  'barbering',
  'hair',
  'nails',
  'lashes',
  'brows',
  'makeup',
  'aesthetics',
  'other',
] as const;

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number];
export type OperatingModel = (typeof OPERATING_MODELS)[number];
export type OrganizationModule = (typeof ORGANIZATION_MODULES)[number];
export type ServiceSpecialty = (typeof SERVICE_SPECIALTIES)[number];
export type ServiceAttentionMode = 'local' | 'home' | 'both';
export type ServiceAppointmentMode = 'booking' | 'walk_in' | 'both';

export type BusinessProfile = {
  businessVertical: string;
  operatingModel: string;
  effectiveModules: string[];
};

export type BusinessProfileDetails = {
  primaryActivity?: PrimaryActivity;
  businessVertical: BusinessVertical;
  operatingModel: OperatingModel;
  enabledModules: OrganizationModule[] | null;
  entitledModules: OrganizationModule[];
  effectiveModules: OrganizationModule[];
  serviceSpecialties: ServiceSpecialty[];
  attentionMode: ServiceAttentionMode;
  appointmentMode: ServiceAppointmentMode;
};

export const VERTICAL_LABELS: Record<string, string> = BUSINESS_VERTICAL_LABELS;
export const MODEL_LABELS: Record<string, string> = OPERATING_MODEL_LABELS;

export const MODEL_HINTS: Record<OperatingModel, string> = {
  retail: 'Vendés productos al cliente final: caja, catálogo y tienda online.',
  wholesale: 'Vendés por volumen: listas de precios, créditos y pedidos grandes.',
  service: 'Vendés tu tiempo: agenda de turnos, reservas online y cobro del servicio en caja.',
  repair: 'Recibís equipos: órdenes de taller, diagnóstico, repuestos y seguimiento.',
  mixed: 'Combinás venta de productos con servicios o taller.',
};

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

export const ATTENTION_MODE_OPTIONS: readonly { value: ServiceAttentionMode; label: string }[] = [
  { value: 'local', label: 'En el local' },
  { value: 'home', label: 'A domicilio' },
  { value: 'both', label: 'Local y domicilio' },
];

export const APPOINTMENT_MODE_OPTIONS: readonly { value: ServiceAppointmentMode; label: string }[] = [
  { value: 'booking', label: 'Con reserva' },
  { value: 'walk_in', label: 'Sin turno' },
  { value: 'both', label: 'Reserva y sin turno' },
];

export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  ORGANIZATION_MODULES.map((module) => [module, moduleDisplayName(module)]),
);

export const moduleHint = (module: string) => moduleDisplayHint(module);

export const isServiceVertical = (vertical: string) =>
  vertical === 'barbershop' || vertical === 'beauty_services';

const MODULE_PRESETS: Record<OperatingModel, OrganizationModule[]> = {
  retail: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'promotions'],
  wholesale: ['inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'credits', 'analytics'],
  service: ['crm', 'services', 'pos'],
  repair: ['inventory', 'pos', 'crm', 'repairs', 'services'],
  mixed: ['inventory', 'pos', 'crm', 'orders', 'repairs', 'services'],
};

const VERTICAL_RECOMMENDATIONS: Record<BusinessVertical, OrganizationModule[]> = {
  general: [],
  clothing: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions', 'web_analytics'],
  cosmetics: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions', 'credits', 'web_analytics'],
  electronics: ['inventory', 'pos', 'crm', 'repairs', 'services', 'orders', 'delivery', 'credits'],
  food: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions', 'web_analytics'],
  hardware: ['inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'delivery', 'credits', 'analytics'],
  barbershop: ['services', 'pos', 'crm', 'inventory', 'promotions', 'web_analytics'],
  beauty_services: ['services', 'pos', 'crm', 'promotions', 'web_analytics'],
  other: [],
};

const VERTICAL_INDEPENDENT_MODULES: readonly OrganizationModule[] = ['finances', 'reports', 'security', 'analytics'];

export function defaultOperatingModelFor(vertical: BusinessVertical | string | null | undefined): OperatingModel {
  return vertical === 'barbershop' || vertical === 'beauty_services' ? 'service' : 'retail';
}

export function getSuggestedModules(
  vertical: BusinessVertical,
  operatingModel: OperatingModel,
): OrganizationModule[] {
  return Array.from(new Set([
    ...MODULE_PRESETS[operatingModel],
    ...VERTICAL_RECOMMENDATIONS[vertical],
  ]));
}

export function modulesForVerticalChange(
  current: readonly OrganizationModule[],
  suggested: readonly OrganizationModule[],
  entitled: ReadonlySet<string>,
): OrganizationModule[] {
  const general = new Set<OrganizationModule>(VERTICAL_INDEPENDENT_MODULES);
  return Array.from(new Set([
    ...suggested.filter((module) => entitled.has(module) && !general.has(module)),
    ...current.filter((module) => general.has(module) && entitled.has(module)),
  ]));
}

type ModuleDependencyRule = {
  module: OrganizationModule;
  needsAnyOf: readonly OrganizationModule[];
  message: string;
};

export const MODULE_DEPENDENCIES: readonly ModuleDependencyRule[] = [
  { module: 'inventory_admin', needsAnyOf: ['inventory'], message: 'Inventario avanzado necesita Inventario.' },
  { module: 'delivery', needsAnyOf: ['orders'], message: 'Entregas necesita Pedidos: se entregan los pedidos online.' },
  { module: 'orders', needsAnyOf: ['inventory', 'services'], message: 'Pedidos necesita Inventario o Servicios: algo para vender.' },
  { module: 'ecommerce', needsAnyOf: ['inventory', 'services'], message: 'La tienda online necesita Inventario o Servicios: algo para mostrar.' },
];

export function moduleDependencyProblems(enabled: readonly OrganizationModule[]): string[] {
  const active = new Set(enabled);
  return MODULE_DEPENDENCIES
    .filter((rule) => active.has(rule.module) && !rule.needsAnyOf.some((needed) => active.has(needed)))
    .map((rule) => rule.message);
}

const isBusinessVertical = (value: unknown): value is BusinessVertical =>
  typeof value === 'string' && (BUSINESS_VERTICALS as readonly string[]).includes(value);

const isOperatingModel = (value: unknown): value is OperatingModel =>
  typeof value === 'string' && (OPERATING_MODELS as readonly string[]).includes(value);

const toModuleList = (value: unknown): OrganizationModule[] =>
  Array.isArray(value)
    ? value.filter((item): item is OrganizationModule =>
        typeof item === 'string' && (ORGANIZATION_MODULES as readonly string[]).includes(item),
      )
    : [];

export function toBusinessProfile(data: Record<string, unknown> | null | undefined): BusinessProfile {
  const modules = Array.isArray(data?.effectiveModules)
    ? data.effectiveModules.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    businessVertical: text(data?.businessVertical) || 'general',
    operatingModel: text(data?.operatingModel) || 'retail',
    effectiveModules: modules,
  };
}

export function toBusinessProfileDetails(data: Record<string, unknown> | null | undefined): BusinessProfileDetails {
  const businessVertical = isBusinessVertical(data?.businessVertical) ? data.businessVertical : 'general';
  const operatingModel = isOperatingModel(data?.operatingModel) ? data.operatingModel : 'retail';
  const effectiveModules = toModuleList(data?.effectiveModules);
  const entitledModules = toModuleList(data?.entitledModules);
  const enabledModules = data?.enabledModules === null
    ? null
    : Array.isArray(data?.enabledModules)
      ? toModuleList(data.enabledModules)
      : null;
  const serviceSpecialties = Array.isArray(data?.serviceSpecialties)
    ? data.serviceSpecialties.filter((item): item is ServiceSpecialty =>
        typeof item === 'string' && (SERVICE_SPECIALTIES as readonly string[]).includes(item),
      )
    : [];
  const attentionMode: ServiceAttentionMode =
    data?.attentionMode === 'home' || data?.attentionMode === 'both' ? data.attentionMode : 'local';
  const appointmentMode: ServiceAppointmentMode =
    data?.appointmentMode === 'walk_in' || data?.appointmentMode === 'both' ? data.appointmentMode : 'booking';

  return {
    primaryActivity: readPrimaryActivity(data?.primaryActivity),
    businessVertical,
    operatingModel,
    enabledModules,
    entitledModules,
    effectiveModules,
    serviceSpecialties,
    attentionMode,
    appointmentMode,
  };
}
