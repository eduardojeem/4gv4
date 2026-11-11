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
  type TemplateAccessData,
  type WebsiteMediaItem,
  type WebsiteMediaSection,
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
    if (error.status === 0)
      return 'Sin conexión. Revisá tu internet: los cambios todavía no se guardaron.';
    if (error.status === 401)
      return 'Tu sesión venció. Volvé a iniciar sesión.';
    if (error.status === 403)
      return 'Solo el dueño o un administrador del comercio pueden cambiar el sitio web.';
    if (error.status === 409 && /sesi[oó]n|negocio/i.test(error.message))
      return error.message;
    if (error.status === 429)
      return (
        error.message ||
        'Guardaste muchas veces seguidas. Esperá un minuto y probá de nuevo.'
      );
    // La conexión anduvo: el problema fue del servidor, no de la persona.
    if (error.status >= 500)
      return 'Hubo un problema en el servidor. Intentá de nuevo en unos minutos.';
    // 400/409/413/422: el servidor ya responde en castellano y sin detalles técnicos.
    if (
      error.status >= 400 &&
      error.status < 500 &&
      error.message &&
      !/^Error \d+$/.test(error.message) &&
      !/[a-z]+_[a-z]+|failed|forbidden/i.test(error.message)
    ) {
      return error.message;
    }
  }
  return fallback;
}

export async function fetchWebsiteSettings(): Promise<WebsiteSettings> {
  const res = await apiFetch<{ success: boolean; data: WebsiteSettings }>(
    '/api/admin/website/settings',
  );
  if (!res?.data?.company_info) throw new ApiError('Respuesta inválida', 500);
  return res.data;
}

export async function fetchTemplateAccess(): Promise<TemplateAccessData | null> {
  try {
    const res = await apiFetch<{
      success?: boolean;
      data?: TemplateAccessData;
    }>('/api/admin/website/storefront-templates');
    return res?.data ?? null;
  } catch {
    return null;
  }
}

/** Guarda claves completas (hasta 10 por pedido). Devuelve lo que quedó guardado. */
export async function saveWebsiteSettings(
  values: Partial<Record<EditableSettingKey, unknown>>,
) {
  const entries = Object.entries(values).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) return {};
  const res = await apiFetch<{
    success: boolean;
    data: Record<string, unknown>;
  }>('/api/admin/website/settings', {
    method: 'PUT',
    body: JSON.stringify({ values: Object.fromEntries(entries) }),
  });
  return res.data ?? {};
}

/**
 * Empresa, apariencia, publicación y dirección: la empresa COMPLETA (lo guardado
 * más lo editado), como la web. Sincroniza también la organización y la sucursal.
 */
export async function saveCompanyInfo(
  saved: CompanyInfo,
  patch: Partial<CompanyInfo>,
  publicationConfirmed = false,
) {
  const res = await apiFetch<{ success: boolean; data: CompanyInfo }>(
    '/api/admin/website/sync-company',
    {
      method: 'PUT',
      body: JSON.stringify(
        buildCompanyPayload(saved, patch, publicationConfirmed),
      ),
    },
  );
  return res.data;
}

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export type WebsiteImageKind = 'logo' | 'banner' | 'aviso' | 'gallery' | 'brand';

const extensionFor = (mime: string) =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

const safeUploadId = (value: string | undefined, fallback: string) => {
  const cleaned = (value ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  return cleaned || fallback;
};

/**
 * El fetch de Expo no acepta el viejo { uri, name, type } de React Native: arma el
 * cuerpo con partes Blob o con objetos que tengan bytes(). El archivo se lee con
 * expo-file-system (fetch no abre las rutas file:// con caracteres codificados).
 * En web, la imagen elegida ya es un blob: del navegador.
 */
export async function formDataFile(
  uri: string,
  name: string,
  type: string,
): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  const file = new File(uri);
  return {
    name,
    type,
    size: file.size,
    bytes: () => file.bytes(),
  } as unknown as Blob;
}

async function appendPickedImageToForm(
  form: FormData,
  image: PickedImage,
): Promise<string> {
  const mime =
    image.mimeType && /^image\/(jpeg|png|webp)$/.test(image.mimeType)
      ? image.mimeType
      : 'image/jpeg';
  const name = image.fileName || `imagen.${extensionFor(mime)}`;
  const file = await formDataFile(image.uri, name, mime);
  // En web el nombre va aparte (Blob); en la app ya viaja dentro de la parte.
  if (Platform.OS === 'web') form.append('file', file, name);
  else form.append('file', file);
  return name;
}

/**
 * Sube una imagen por el servidor, que la optimiza y la guarda en la carpeta de
 * la organización activa (website/<carpeta>/<organization_id>/...). Las imágenes
 * nuevas suman al historial de medios (límite 20).
 */
export async function uploadWebsiteImage(
  kind: WebsiteImageKind,
  image: PickedImage,
  slideId?: string,
): Promise<string> {
  const form = new FormData();
  await appendPickedImageToForm(form, image);

  let path = '/api/admin/website/promotion-image';
  if (kind === 'logo') {
    path = '/api/admin/website/logo';
  } else if (kind === 'brand') {
    path = '/api/admin/website/brand-logo';
    form.append(
      'brandId',
      (slideId ?? 'brand').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) ||
        'brand',
    );
  } else if (kind === 'aviso') {
    form.append('slideId', 'aviso');
  } else if (kind === 'gallery') {
    const clean = safeUploadId(slideId, 'foto');
    form.append(
      'slideId',
      clean.startsWith('galeria') ? clean : `galeria-${clean}`,
    );
  } else {
    form.append('slideId', safeUploadId(slideId, 'mobile'));
  }

  const res = await apiFetch<{
    success?: boolean;
    url?: string;
    error?: string;
  }>(path, { method: 'POST', body: form });
  if (!res?.url)
    throw new ApiError(res?.error || 'No se pudo subir la imagen.', 500);
  return res.url;
}

export async function uploadBrandLogo(
  image: PickedImage,
  brandId = 'brand',
): Promise<string> {
  return uploadWebsiteImage('brand', image, brandId);
}

// ─── Biblioteca de medios (límite 20) ────────────────────────────────────────

export type WebsiteMediaQuota = {
  items: WebsiteMediaItem[];
  count: number;
  limit: number;
};

export async function fetchWebsiteMedia(): Promise<WebsiteMediaQuota> {
  const res = await apiFetch<{
    success?: boolean;
    items?: WebsiteMediaItem[];
    count?: number;
    limit?: number;
  }>('/api/admin/website/media');
  const items = Array.isArray(res?.items) ? res.items : [];
  return {
    items,
    count: typeof res?.count === 'number' ? res.count : items.length,
    limit: typeof res?.limit === 'number' ? res.limit : 20,
  };
}

export async function uploadWebsiteMedia(
  image: PickedImage,
  section: WebsiteMediaSection = 'general',
  customName?: string,
): Promise<{ item: WebsiteMediaItem; count: number; limit: number }> {
  const form = new FormData();
  const name = await appendPickedImageToForm(form, image);
  form.append('section', section);
  form.append('name', (customName ?? name).slice(0, 120));
  const res = await apiFetch<{
    success?: boolean;
    item?: WebsiteMediaItem;
    count?: number;
    limit?: number;
    error?: string;
  }>('/api/admin/website/media', { method: 'POST', body: form });
  if (!res?.item)
    throw new ApiError(res?.error || 'No se pudo subir la imagen.', 500);
  return {
    item: res.item,
    count: typeof res.count === 'number' ? res.count : 0,
    limit: typeof res.limit === 'number' ? res.limit : 20,
  };
}

export async function deleteWebsiteMedia(target: {
  id?: string;
  path?: string;
  url?: string;
}): Promise<{ count: number; limit: number }> {
  const res = await apiFetch<{
    success?: boolean;
    count?: number;
    limit?: number;
    error?: string;
  }>('/api/admin/website/media', {
    method: 'DELETE',
    body: JSON.stringify(target),
  });
  return {
    count: typeof res?.count === 'number' ? res.count : 0,
    limit: typeof res?.limit === 'number' ? res.limit : 20,
  };
}

// ─── Google Maps short link ──────────────────────────────────────────────────

export async function resolveMapsShortLink(url: string): Promise<{
  url: string;
  resolved: boolean;
  coordinates: { lat: number; lng: number } | null;
}> {
  return apiFetch<{
    url: string;
    resolved: boolean;
    coordinates: { lat: number; lng: number } | null;
  }>('/api/admin/website/maps-link', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

// ─── Marcas de la tienda (S1: solo datos públicos de marcas) ──────────────────

export type StoreBrandSummary = {
  id: string;
  name: string;
  logoUrl?: string;
  productCount: number;
  isFromBrandsTable: boolean;
};

export async function fetchStoreBrandsSummary(): Promise<StoreBrandSummary[]> {
  const [brandsResult, productsResult] = await Promise.allSettled([
    apiFetch<{
      success?: boolean;
      data?: {
        id?: string;
        name?: string;
        logo_url?: string | null;
        stats?: { product_count?: number };
      }[];
    }>('/api/brands?limit=100'),
    apiFetch<{
      success?: boolean;
      data?: { products?: { brand?: string | null }[] };
    }>('/api/products?per_page=100&is_active=true'),
  ]);

  const map = new Map<string, StoreBrandSummary>();

  if (
    brandsResult.status === 'fulfilled' &&
    Array.isArray(brandsResult.value?.data)
  ) {
    for (const row of brandsResult.value.data) {
      const name = typeof row?.name === 'string' ? row.name.trim() : '';
      if (!name) continue;
      const key = name.toLowerCase();
      map.set(key, {
        id: row.id || key.replace(/\s+/g, '-'),
        name,
        logoUrl: row.logo_url || undefined,
        productCount:
          typeof row.stats?.product_count === 'number'
            ? row.stats.product_count
            : 0,
        isFromBrandsTable: true,
      });
    }
  }

  if (
    productsResult.status === 'fulfilled' &&
    Array.isArray(productsResult.value?.data?.products)
  ) {
    const productCounts = new Map<string, number>();
    for (const product of productsResult.value.data.products) {
      const brandName =
        typeof product?.brand === 'string' ? product.brand.trim() : '';
      if (!brandName) continue;
      const key = brandName.toLowerCase();
      productCounts.set(key, (productCounts.get(key) ?? 0) + 1);
      if (!map.has(key)) {
        map.set(key, {
          id: key.replace(/\s+/g, '-'),
          name: brandName,
          productCount: 0,
          isFromBrandsTable: false,
        });
      }
    }
    for (const [key, count] of productCounts.entries()) {
      const entry = map.get(key);
      if (entry) entry.productCount = Math.max(entry.productCount, count);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  );
}

export const storeUrl = (company: CompanyInfo) =>
  publicStoreUrl(SITE_URL, company.slug);

// ─── Productos destacados ──────────────────────────────────────────────────

/** Productos del comercio activo (la API filtra por organización), solo con datos públicos. */
export async function searchStoreProductsPage(
  search: string,
  onlyFeatured = false,
  page = 1,
): Promise<{ items: PublicProduct[]; nextPage: number | null }> {
  const params = new URLSearchParams({
    per_page: '30',
    is_active: 'true',
    page: String(page),
  });
  if (search.trim()) params.set('query', search.trim());
  if (onlyFeatured) params.set('featured', 'true');
  const res = await apiFetch<{
    data?: { products?: Record<string, unknown>[]; total?: number };
  }>(`/api/products?${params}`);
  const items = (res.data?.products ?? []).map(toPublicProduct);
  const total = res.data?.total;
  return {
    items,
    nextPage:
      items.length &&
      (total === undefined ? items.length === 30 : page * 30 < total)
        ? page + 1
        : null,
  };
}
export async function searchStoreProducts(
  search: string,
  onlyFeatured = false,
): Promise<PublicProduct[]> {
  return (await searchStoreProductsPage(search, onlyFeatured)).items;
}

export async function setProductFeatured(id: string, featured: boolean) {
  await apiFetch(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ featured }),
  });
}
