/**
 * «Configuración» del comercio en la app: los MISMOS datos que /admin/settings
 * en la web (system_settings + organization_settings del comercio activo).
 * Lógica pura, sin React Native, para poder probarla.
 */
import {
  REGIONAL_CURRENCIES,
  getRegionalCurrencySymbol,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeLocaleCode,
  type CountryCode,
  type LocaleCode,
} from '../../../src/lib/regional/contract';
import { needsCountryConfirmation } from '../../../src/lib/regional/settings';

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

/** Las mismas zonas que ofrece la web. */
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
  { code: 'America/New_York', name: 'Nueva York, Estados Unidos' },
  { code: 'UTC', name: 'UTC' },
];

const isKnown = (list: readonly { code: string }[], value: unknown): value is string =>
  typeof value === 'string' && list.some((item) => item.code === value);

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
  if (draft.companyRuc.trim().length > 50) issues.companyRuc = 'El RUC no puede superar 50 caracteres.';
  if (draft.companyAddress.trim().length > 500) issues.companyAddress = 'La dirección no puede superar 500 caracteres.';
  if (draft.city.trim().length > 100) issues.city = 'La ciudad no puede superar 100 caracteres.';
  if (!Number.isFinite(draft.taxRate)) issues.taxRate = 'Ingresá el IVA en números, por ejemplo 10.';
  else if (draft.taxRate < 0 || draft.taxRate > 100) issues.taxRate = 'El IVA tiene que estar entre 0 y 100 %.';
  if (!isKnown(TIME_ZONES, draft.timeZone)) issues.timeZone = 'Elegí una zona horaria de la lista.';
  return issues;
}

export const currencyName = (code: string) => CURRENCIES.find((item) => item.code === code)?.name ?? code;
export const currencySymbol = (code: string) => {
  const normalized = normalizeCurrencyCode(code);
  return normalized ? getRegionalCurrencySymbol(normalized, 'es-PY') : code;
};
export const timeZoneName = (code: string) => TIME_ZONES.find((item) => item.code === code)?.name ?? code;
export const languageName = (code: string) => LANGUAGES.find((item) => item.code === code)?.name ?? code;

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

/** Cómo se ve el tipo de cambio: «1 USD = Gs. 7.300». */
export function describeRate(rate: Pick<ExchangeRate, 'currency' | 'rate'>, localCurrency: string): string {
  return `1 ${rate.currency} = ${currencySymbol(localCurrency)} ${formatNumber(rate.rate, Number.isInteger(rate.rate) ? 0 : 2)}`;
}

// ─── Perfil del negocio (solo lectura en la app) ───────────────────────────

export type BusinessProfile = {
  businessVertical: string;
  operatingModel: string;
  effectiveModules: string[];
};

export const VERTICAL_LABELS: Record<string, string> = {
  general: 'Comercio general',
  clothing: 'Ropa y moda',
  barbershop: 'Barbería y peluquería',
  beauty_services: 'Belleza y cuidado personal',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Electrónica y tecnología',
  food: 'Alimentos',
  hardware: 'Ferretería',
  other: 'Otro rubro',
};

export const MODEL_LABELS: Record<string, string> = {
  retail: 'Venta minorista',
  wholesale: 'Venta mayorista',
  service: 'Prestación de servicios',
  repair: 'Taller y reparaciones',
  mixed: 'Negocio mixto',
};

/** Los nombres del catálogo de planes, los mismos que ve el cliente en la web. */
export const MODULE_LABELS: Record<string, string> = {
  pos: 'Punto de Venta (POS)',
  ecommerce: 'Ecommerce & Marketplace',
  orders: 'Pedidos',
  delivery: 'Entregas',
  promotions: 'Promociones y descuentos',
  credits: 'Créditos y cuotas',
  inventory: 'Inventario',
  inventory_admin: 'Inventario avanzado',
  repairs: 'Módulo de Reparaciones',
  services: 'Servicios',
  crm: 'CRM / Gestión de clientes',
  analytics: 'Analytics avanzado',
  web_analytics: 'Visitas web',
  security: 'Seguridad y auditoría',
  finances: 'Finanzas y rentabilidad',
  reports: 'Reportes exportables (CSV/PDF)',
};

export function toBusinessProfile(data: Record<string, unknown> | null | undefined): BusinessProfile {
  const modules = Array.isArray(data?.effectiveModules) ? data.effectiveModules.filter((item): item is string => typeof item === 'string') : [];
  return {
    businessVertical: text(data?.businessVertical) || 'general',
    operatingModel: text(data?.operatingModel) || 'retail',
    effectiveModules: modules,
  };
}
