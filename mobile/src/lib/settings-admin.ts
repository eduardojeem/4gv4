import { ApiError, apiFetch } from './api';
import {
  fromSharedRow,
  toBusinessProfile,
  toBusinessProfileDetails,
  type AdminMfaPolicy,
  type BusinessProfile,
  type BusinessProfileDetails,
  type BusinessVertical,
  type ExchangeRatesState,
  type OperatingModel,
  type OrgSettings,
  type OrganizationModule,
  type ServiceAppointmentMode,
  type ServiceAttentionMode,
  type ServiceSpecialty,
  type SettingsSetupStatus,
} from './settings-model';
import { websiteErrorMessage } from './website-admin';

/**
 * «Configuración» en la app: las MISMAS APIs que usa /admin/settings en la web.
 * El servidor resuelve el comercio activo y exige dueño o administrador.
 */

/** Mensaje para la persona, nunca el error técnico. */
export function settingsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) {
    const code = error.body?.code;
    if ((code === 'MFA_REQUIRED' || code === 'MFA_ENROLLMENT_REQUIRED') && error.message) {
      return error.message;
    }
    return 'Solo el dueño o un administrador del comercio pueden cambiar la configuración.';
  }
  return websiteErrorMessage(error, fallback);
}

/** El servidor pide confirmar el cambio de moneda antes de aplicarlo. */
export const needsCurrencyConfirmation = (error: unknown) =>
  error instanceof ApiError && error.status === 409 && error.body?.code === 'CURRENCY_CHANGE_CONFIRMATION_REQUIRED';

export async function fetchOrgSettings(): Promise<OrgSettings> {
  const res = await apiFetch<{ success: boolean; scope?: string; data?: Record<string, unknown> }>('/api/settings/shared');
  if (!res?.data) throw new ApiError('Respuesta inválida', 500);
  // Sin comercio activo (solo un superadmin) llega la configuración de la plataforma: no se edita desde acá.
  if (res.scope === 'platform') throw new ApiError('Entrá a un comercio para ver su configuración.', 403);
  return fromSharedRow(res.data);
}

/**
 * Guarda solo lo que cambió, con el alcance del comercio (como la web). Devuelve
 * la configuración que quedó guardada.
 */
export async function saveOrgSettings(changes: Partial<OrgSettings>, confirmCurrencyChange = false): Promise<OrgSettings | null> {
  if (Object.keys(changes).length === 0) return null;
  const res = await apiFetch<{ success: boolean; data?: Record<string, unknown> }>('/api/admin/system/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings: changes, scope: 'organization', confirmCurrencyChange }),
  });
  return res?.data ? fromSharedRow(res.data) : null;
}

export async function fetchSetupStatus(): Promise<SettingsSetupStatus | null> {
  const res = await apiFetch<{ success?: boolean; data?: SettingsSetupStatus }>('/api/admin/settings/setup-status');
  return res?.data ?? null;
}

export async function fetchAdminMfaPolicy(): Promise<AdminMfaPolicy> {
  const res = await apiFetch<{ requireAdminMfa?: boolean; canChange?: boolean }>('/api/admin/security/mfa-policy');
  return {
    requireAdminMfa: res.requireAdminMfa === true,
    canChange: res.canChange === true,
  };
}

export async function updateAdminMfaPolicy(requireAdminMfa: boolean): Promise<AdminMfaPolicy> {
  const res = await apiFetch<{ requireAdminMfa?: boolean; canChange?: boolean }>('/api/admin/security/mfa-policy', {
    method: 'PUT',
    body: JSON.stringify({ requireAdminMfa }),
  });
  return {
    requireAdminMfa: res.requireAdminMfa === true,
    canChange: res.canChange === true,
  };
}

export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  const res = await apiFetch<{ success: boolean; data?: Record<string, unknown> }>('/api/admin/organization-profile');
  return toBusinessProfile(res?.data);
}

export async function fetchBusinessProfileDetails(): Promise<BusinessProfileDetails> {
  const res = await apiFetch<{ success: boolean; data?: Record<string, unknown> }>('/api/admin/organization-profile');
  return toBusinessProfileDetails(res?.data);
}

export type SaveBusinessProfileInput = {
  primaryActivity?: 'auto'|'pos'|'agenda'|'repairs';
  businessVertical: BusinessVertical;
  operatingModel: OperatingModel;
  enabledModules: OrganizationModule[] | null;
  serviceSpecialties?: ServiceSpecialty[];
  attentionMode?: ServiceAttentionMode;
  appointmentMode?: ServiceAppointmentMode;
};

export async function saveBusinessProfile(input: SaveBusinessProfileInput): Promise<BusinessProfileDetails> {
  const res = await apiFetch<{ success: boolean; data?: Record<string, unknown> }>('/api/admin/organization-profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toBusinessProfileDetails(res?.data);
}

// ─── Tipos de cambio ───────────────────────────────────────────────────────

export async function fetchExchangeRates(): Promise<ExchangeRatesState> {
  const res = await apiFetch<Partial<ExchangeRatesState>>('/api/exchange-rates');
  return {
    available: res.available !== false,
    canEdit: res.canEdit === true,
    localCurrency: res.localCurrency || 'PYG',
    rates: (res.rates ?? []).map((rate) => ({ ...rate, rate: Number(rate.rate), rounding: Number(rate.rounding) })),
    history: res.history ?? [],
    usage: res.usage ?? {},
  };
}

/** Guarda el tipo de cambio; el servidor recalcula los precios de los productos en esa moneda. */
export async function saveExchangeRate(currency: string, rate: number, rounding: number) {
  const res = await apiFetch<{ ok?: boolean; result?: { products_updated?: number } }>('/api/exchange-rates', {
    method: 'POST',
    body: JSON.stringify({ currency, rate, rounding }),
  });
  return { productsUpdated: Number(res?.result?.products_updated ?? 0) };
}

/** El servidor la rechaza si algún producto todavía usa esa moneda. */
export async function deleteExchangeRate(currency: string) {
  await apiFetch(`/api/exchange-rates?currency=${encodeURIComponent(currency)}`, { method: 'DELETE' });
}
