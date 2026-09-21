import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteMediaItem, WebsiteMediaSection } from '@/types/website-settings'
export type { WebsiteMediaItem, WebsiteMediaSection }

export const MAX_WEBSITE_MEDIA_COUNT = 20

const PUBLIC_STORAGE_MARKER = '/storage/v1/object/public/product-images/'

/**
 * Extrae la ruta de almacenamiento interno (bucket product-images) desde una URL pública
 */
export function getWebsiteStoragePathFromUrl(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const markerIndex = url.pathname.indexOf(PUBLIC_STORAGE_MARKER)
    if (markerIndex < 0) return null

    const path = decodeURIComponent(url.pathname.slice(markerIndex + PUBLIC_STORAGE_MARKER.length))
    if (!path.startsWith('website/') || path.includes('..') || path.includes('\\')) return null
    return path
  } catch {
    if (value.startsWith('website/') && !value.includes('..') && !value.includes('\\')) {
      return value
    }
    return null
  }
}

/**
 * Valida que una ruta de almacenamiento pertenezca estrictamente a la organización
 * Formato esperado: website/<section>/<organizationId>/<filename>
 */
export function isOrganizationWebsitePath(path: string, organizationId: string): boolean {
  if (!path || !path.startsWith('website/') || path.includes('..') || path.includes('\\')) return false
  const segments = path.split('/')
  return segments.length >= 4 && segments[2] === organizationId
}

/**
 * Infiere la sección del sitio web a partir de la ruta o URL
 */
export function inferMediaSection(pathOrUrl: string): WebsiteMediaSection {
  const lower = pathOrUrl.toLowerCase()
  if (lower.includes('/logos/') || lower.includes('logo')) return 'logo'
  if (lower.includes('/promotions/') || lower.includes('promotion') || lower.includes('carrusel')) return 'promotions'
  if (lower.includes('/brands/') || lower.includes('brand') || lower.includes('marca')) return 'brands'
  if (lower.includes('/announcements/') || lower.includes('aviso') || lower.includes('cartel')) return 'announcements'
  return 'general'
}

/**
 * Obtiene el historial de medios de la organización.
 * Si aún no está inicializado, descubre las imágenes existentes en la configuración actual del sitio web.
 */
export async function getWebsiteMediaLibrary(
  organizationId: string,
  adminSupabase: SupabaseClient
): Promise<WebsiteMediaItem[]> {
  const { data: mediaRow } = await adminSupabase
    .from('website_settings')
    .select('value')
    .eq('key', 'media_library')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (mediaRow?.value && Array.isArray(mediaRow.value) && mediaRow.value.length > 0) {
    return mediaRow.value as WebsiteMediaItem[]
  }

  // Descubrimiento inicial: recopilar imágenes ya configuradas en las otras secciones
  const { data: settingsRows } = await adminSupabase
    .from('website_settings')
    .select('key, value')
    .eq('organization_id', organizationId)
    .in('key', ['company_info', 'promotional_carousel', 'announcement', 'announcements', 'brands_section'])

  const discoveredItems: WebsiteMediaItem[] = []
  const seenPaths = new Set<string>()

  const registerDiscovered = (url: string | undefined, defaultSection: WebsiteMediaSection, defaultName: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return
    const path = getWebsiteStoragePathFromUrl(url)
    if (!path || !isOrganizationWebsitePath(path, organizationId) || seenPaths.has(path)) return
    seenPaths.add(path)
    discoveredItems.push({
      id: randomUUID(),
      url,
      path,
      name: defaultName,
      section: defaultSection,
      createdAt: new Date().toISOString(),
    })
  }

  if (settingsRows) {
    for (const row of settingsRows) {
      const val = row.value
      if (!val) continue

      if (row.key === 'company_info' && val.logoUrl) {
        registerDiscovered(val.logoUrl, 'logo', 'Logo de la empresa')
      } else if (row.key === 'promotional_carousel' && Array.isArray(val.slides)) {
        for (const slide of val.slides) {
          if (slide?.imageUrl) {
            registerDiscovered(slide.imageUrl, 'promotions', slide.title || 'Diapositiva de carrusel')
          }
        }
      } else if (row.key === 'announcements' && Array.isArray(val)) {
        for (const ann of val) {
          if (Array.isArray(ann?.images)) {
            for (const img of ann.images) {
              registerDiscovered(img.url, 'announcements', ann.title || 'Imagen de aviso')
            }
          } else if (ann?.imageUrl) {
            registerDiscovered(ann.imageUrl, 'announcements', ann.title || 'Imagen de aviso')
          }
        }
      } else if (row.key === 'announcement' && val.imageUrl) {
        registerDiscovered(val.imageUrl, 'announcements', val.title || 'Imagen de aviso')
      } else if (row.key === 'brands_section' && Array.isArray(val.items)) {
        for (const brand of val.items) {
          if (brand?.logoUrl) {
            registerDiscovered(brand.logoUrl, 'brands', brand.name ? `Logo ${brand.name}` : 'Logo de marca')
          }
        }
      }
    }
  }

  // Si encontramos imágenes previas, las guardamos para persistir el historial
  if (discoveredItems.length > 0) {
    const trimmed = discoveredItems.slice(0, MAX_WEBSITE_MEDIA_COUNT)
    await adminSupabase.from('website_settings').upsert({
      key: 'media_library',
      organization_id: organizationId,
      value: trimmed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,key' })
    return trimmed
  }

  return []
}

/**
 * Agrega un nuevo ítem a la biblioteca verificando la cuota estricta de 20 imágenes.
 */
export async function addWebsiteMediaItem(
  organizationId: string,
  item: Omit<WebsiteMediaItem, 'id' | 'createdAt'>,
  adminSupabase: SupabaseClient
): Promise<{ success: boolean; item?: WebsiteMediaItem; count: number; error?: string }> {
  const current = await getWebsiteMediaLibrary(organizationId, adminSupabase)

  // Si ya existe por path o URL, lo reutilizamos
  const existing = current.find(
    (it) => (it.path && it.path === item.path) || (it.url && it.url === item.url)
  )
  if (existing) {
    return { success: true, item: existing, count: current.length }
  }

  // Validación de cuota estricta: 20 imágenes máximo
  if (current.length >= MAX_WEBSITE_MEDIA_COUNT) {
    return {
      success: false,
      count: current.length,
      error: `Alcanzaste el límite de ${MAX_WEBSITE_MEDIA_COUNT} imágenes para tu sitio web. Eliminá imágenes desde el Historial para liberar espacio.`,
    }
  }

  const newItem: WebsiteMediaItem = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    url: item.url,
    path: item.path,
    name: item.name || 'imagen',
    size: item.size,
    section: item.section || inferMediaSection(item.path),
  }

  const updated = [newItem, ...current].slice(0, MAX_WEBSITE_MEDIA_COUNT)

  const { error: upsertError } = await adminSupabase.from('website_settings').upsert({
    key: 'media_library',
    organization_id: organizationId,
    value: updated,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,key' })

  if (upsertError) {
    return {
      success: false,
      count: current.length,
      error: `Error al guardar en el historial: ${upsertError.message}`,
    }
  }

  return { success: true, item: newItem, count: updated.length }
}

/**
 * Elimina definitivamente un archivo de imagen de Supabase Storage y de la biblioteca de medios.
 * Libera cupo de forma inmediata.
 */
export async function deleteWebsiteMediaItem(
  organizationId: string,
  identifier: { id?: string; path?: string; url?: string },
  adminSupabase: SupabaseClient
): Promise<{ success: boolean; count: number; error?: string }> {
  const current = await getWebsiteMediaLibrary(organizationId, adminSupabase)

  const itemIndex = current.findIndex((it) => {
    if (identifier.id && it.id === identifier.id) return true
    if (identifier.path && it.path === identifier.path) return true
    if (identifier.url && it.url === identifier.url) return true
    return false
  })

  const item = itemIndex >= 0 ? current[itemIndex] : null
  const storagePath = item?.path || identifier.path || getWebsiteStoragePathFromUrl(identifier.url || '')

  if (!storagePath) {
    return { success: false, count: current.length, error: 'No se pudo identificar la imagen para eliminar.' }
  }

  if (!isOrganizationWebsitePath(storagePath, organizationId)) {
    return { success: false, count: current.length, error: 'La imagen no pertenece a esta organización.' }
  }

  // Eliminar el archivo físico de Supabase Storage
  const { error: storageError } = await adminSupabase.storage
    .from('product-images')
    .remove([storagePath])

  if (storageError) {
    console.warn('Storage removal warning:', storageError.message)
  }

  // Remover de la lista persistida
  const nextItems = current.filter((it) => it.id !== item?.id && it.path !== storagePath)

  await adminSupabase.from('website_settings').upsert({
    key: 'media_library',
    organization_id: organizationId,
    value: nextItems,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,key' })

  return { success: true, count: nextItems.length }
}
