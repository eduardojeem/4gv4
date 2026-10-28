import { formatCurrencyAmount, normalizeCurrencyCode, resolveEffectiveLocale } from '../../../src/lib/regional/contract';

type MobileRegionalFormatConfig = {
  locale: string | null;
  countryCode: string | null;
  language: string | null;
};

let regionalConfig: MobileRegionalFormatConfig = { locale: null, countryCode: null, language: null };

export function setMobileRegionalFormatConfig(config: MobileRegionalFormatConfig) {
  regionalConfig = config;
}

export function getMobileDisplayLocale() {
  return resolveEffectiveLocale(regionalConfig);
}

export function formatMobileCurrency(amount: number, currency: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const supportedCurrency = normalizeCurrencyCode(currency) ?? 'PYG';
  return formatCurrencyAmount(safeAmount, supportedCurrency, getMobileDisplayLocale());
}

export function formatMobileNumber(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(getMobileDisplayLocale(), options).format(value);
}

export function formatMobileDate(value: Date | string | number, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getMobileDisplayLocale(), options).format(date);
}
