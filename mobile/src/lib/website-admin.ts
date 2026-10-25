import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { ApiError, apiFetch } from './api';
import { SITE_URL } from './marketplace';
import {
  buildCompanyPayload,
  publicStoreUrl,
  toPublicProduct,
  type CompanyInfo,
  type EditableSettingKey,
  type PublicProduct,
  type WebsiteSettings,
} from './website-model';

/**
 * «Sitio web» en la app: las MISMAS APIs que usa /admin/website en la web. El
 * servidor resuelve la organización activa y exige dueño o administrador; la
 * app nunca manda el id de la organización en el cuerpo ni usa service_role.
 */

/** Mensaje para la persona, nunca el error técnico de Supabase. */
export function websiteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Sin conexión. Revisá tu internet: los cambios todavía no se guardaron.';
    if (error.status === 401) return 'Tu sesión venció. Volvé a iniciar sesión.';
    if (error.status === 403) return 'Solo el dueño o un administrador del comercio pueden cambiar el sitio web.';
    if (error.status === 409 && /sesi[oó]n|negocio/i.test(error.message)) return error.message;
    if (error.status === 429) return error.message || 'Guardaste muchas veces seguidas. Esperá un minuto y probá de nuevo.';
    // La conexión anduvo: el problema fue del servidor, no de la persona.
    if (error.status >= 500) return 'Hubo un problema en el servidor. Intentá de nuevo en unos minutos.';
    // 400/409/413/422: el servidor ya responde en castellano y sin detalles técnicos.
    if (error.status >= 400 && error.status < 500 && error.message && !/^Error \d+$/.test(error.message) && !/[a-z]+_[a-z]+|failed|forbidden/i.test(error.message)) {
      return error.message;
    }
  }
  return fallback;
}

export async function fetchWebsiteSettings(): Promise<WebsiteSettings> {
  const res = await apiFetch<{ success: boolean; data: WebsiteSettings }>('/api/admin/website/settings');
  if (!res?.data?.company_info) throw new ApiError('Respuesta inválida', 500);
  return res.data;
}

/** Guarda claves completas (hasta 10 por pedido). Devuelve lo que quedó guardado. */
export async function saveWebsiteSettings(values: Partial<Record<EditableSettingKey, unknown>>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return {};
  const res = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/admin/website/settings', {
    method: 'PUT',
    body: JSON.stringify({ values: Object.fromEntries(entries) }),
  });
  return res.data ?? {};
}

/**
 * Empresa, apariencia, publicación y dirección: la empresa COMPLETA (lo guardado
 * más lo editado), como la web. Sincroniza también la organización y la sucursal.
 */
export async function saveCompanyInfo(saved: CompanyInfo, patch: Partial<CompanyInfo>, publicationConfirmed = false) {
  const res = await apiFetch<{ success: boolean; data: CompanyInfo }>('/api/admin/website/sync-company', {
    method: 'PUT',
    body: JSON.stringify(buildCompanyPayload(saved, patch, publicationConfirmed)),
  });
  return res.data;
}

export type PickedImage = { uri: string; mimeType?: string | null; fileName?: string | null };

const extensionFor = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

/**
 * El fetch de Expo no acepta el viejo { uri, name, type } de React Native: arma el
 * cuerpo con partes Blob o con objetos que tengan bytes(). El archivo se lee con
 * expo-file-system (fetch no abre las rutas file:// con caracteres codificados).
 * En web, la imagen elegida ya es un blob: del navegador.
 */
async function formDataFile(uri: string, name: string, type: string): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  const file = new File(uri);
  return { name, type, size: file.size, bytes: () => file.bytes() } as unknown as Blob;
}

/**
 * Sube una imagen por el servidor, que la optimiza y la guarda en la carpeta de
 * la organización activa (website/<carpeta>/<organization_id>/...). La imagen
 * anterior no se borra: queda en el historial de medios del sitio.
 */
export async function uploadWebsiteImage(kind: 'logo' | 'banner', image: PickedImage, slideId?: string): Promise<string> {
  const mime = image.mimeType && /^image\/(jpeg|png|webp)$/.test(image.mimeType) ? image.mimeType : 'image/jpeg';
  const name = image.fileName || `imagen.${extensionFor(mime)}`;
  const form = new FormData();
  const file = await formDataFile(image.uri, name, mime);
  // En web el nombre va aparte (Blob); en la app ya viaja dentro de la parte.
  if (Platform.OS === 'web') form.append('file', file, name);
  else form.append('file', file);
  if (kind === 'banner') form.append('slideId', slideId || 'mobile');
  const path = kind === 'logo' ? '/api/admin/website/logo' : '/api/admin/website/promotion-image';
  const res = await apiFetch<{ success?: boolean; url?: string; error?: string }>(path, { method: 'POST', body: form });
  if (!res?.url) throw new ApiError(res?.error || 'No se pudo subir la imagen.', 500);
  return res.url;
}

export const storeUrl = (company: CompanyInfo) => publicStoreUrl(SITE_URL, company.slug);

// ─── Productos destacados ──────────────────────────────────────────────────

/** Productos del comercio activo (la API filtra por organización), solo con datos públicos. */
export async function searchStoreProducts(search: string, onlyFeatured = false): Promise<PublicProduct[]> {
  const params = new URLSearchParams({ per_page: '30', is_active: 'true' });
  if (search.trim()) params.set('query', search.trim());
  if (onlyFeatured) params.set('featured', 'true');
  const res = await apiFetch<{ data?: { products?: Record<string, unknown>[] } }>(`/api/products?${params}`);
  return (res.data?.products ?? []).map(toPublicProduct);
}

export async function setProductFeatured(id: string, featured: boolean) {
  await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ featured }) });
}
