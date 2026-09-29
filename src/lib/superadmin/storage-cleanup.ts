import { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

/**
 * Detección de imágenes de productos huérfanas en el bucket `product-images`.
 *
 * La versión anterior (src/services/storage-cleanup-service.ts) comparaba todo
 * el bucket solo contra `products` y desde el navegador: marcaba como
 * huérfanos el logo y el favicon de la plataforma, los logos de las tiendas y
 * los medios del sitio, y, por RLS, también imágenes de productos de tiendas a
 * las que el SuperAdmin no pertenece. Medido el 2026-09-27: 46 archivos en uso
 * marcados para borrar.
 *
 * Reglas de esta versión (todas en el servidor, con la service role):
 *  1. Solo son candidatos los archivos de `products/`. `branding/`, `logos/`,
 *     `website/` y cualquier otra carpeta nunca se proponen.
 *  2. Un archivo se considera en uso si su ruta aparece en CUALQUIER columna de
 *     las tablas de REFERENCE_TABLES (se busca en el JSON de la fila completa,
 *     así no depende de conocer cada columna).
 *  3. Nunca se proponen archivos modificados en los últimos MIN_AGE_DAYS días
 *     (pueden pertenecer a un formulario que todavía no se guardó).
 *  4. Si alguna fuente de referencias falla, el escaneo se cancela: jamás se
 *     decide con información parcial.
 */
export const CLEANUP_BUCKET = 'product-images'
export const CANDIDATE_PREFIX = 'products/'
export const MIN_AGE_DAYS = 7

const REFERENCE_TABLES = [
  'products',
  'product_variants',
  'brands',
  'global_brands',
  'categories',
  'global_categories',
  'organizations',
  'organization_settings',
  'website_settings',
  'system_settings',
  'promotions',
  'promotions_carousel',
  'posts',
  'content',
  'profiles',
  'repair_images',
  'communication_templates',
  'customer_segments',
] as const

/** Ruta dentro del bucket, con o sin la URL pública delante. */
const PATH_PATTERN = /(?:product-images\/)?(products\/[A-Za-z0-9._~%\-/]+)/g

export interface OrphanCandidate {
  path: string
  size: number
  updatedAt: string | null
  publicUrl: string
}

export interface StorageScanResult {
  scannedAt: string
  totalFiles: number
  totalBytes: number
  folders: Array<{ folder: string; files: number; bytes: number; protected: boolean }>
  referencedPaths: number
  candidates: OrphanCandidate[]
  candidateBytes: number
  skippedRecent: number
  sources: string[]
}

export type StorageFile = { path: string; size: number; updatedAt: string | null }

async function listBucket(admin: ReturnType<typeof createAdminSupabase>, folder = ''): Promise<StorageFile[]> {
  const files: StorageFile[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(CLEANUP_BUCKET).list(folder, { limit: 1000, offset })
    if (error) throw new Error(`No se pudo listar ${CLEANUP_BUCKET}/${folder}: ${error.message}`)
    for (const item of data ?? []) {
      const path = folder ? `${folder}/${item.name}` : item.name
      if (item.id === null) {
        files.push(...(await listBucket(admin, path)))
      } else {
        const metadata = item.metadata as { size?: number } | null
        files.push({ path, size: Number(metadata?.size ?? 0), updatedAt: item.updated_at ?? item.created_at ?? null })
      }
    }
    if ((data ?? []).length < 1000) break
  }
  return files
}

/** Rutas de `products/` mencionadas en un texto (URL pública o ruta relativa). */
export function extractReferencedPaths(text: string): string[] {
  const paths: string[] = []
  for (const match of text.matchAll(PATH_PATTERN)) {
    let path = match[1].replace(/\\/g, '')
    try {
      path = decodeURIComponent(path)
    } catch {
      // Secuencia % inválida: se usa tal cual (más referencias = más conservador).
    }
    paths.push(path)
  }
  return paths
}

/** Reglas 1 y 3: solo `products/`, no referenciados y con más de MIN_AGE_DAYS. */
export function selectOrphanCandidates(files: StorageFile[], referenced: Set<string>, cutoffMs: number) {
  let skippedRecent = 0
  const candidates: StorageFile[] = []
  for (const file of files) {
    if (!file.path.startsWith(CANDIDATE_PREFIX) || referenced.has(file.path)) continue
    if (!file.updatedAt || Date.parse(file.updatedAt) > cutoffMs) {
      skippedRecent += 1
      continue
    }
    candidates.push(file)
  }
  candidates.sort((a, b) => b.size - a.size)
  return { candidates, skippedRecent }
}

async function collectReferencedPaths(admin: ReturnType<typeof createAdminSupabase>): Promise<Set<string>> {
  const referenced = new Set<string>()
  for (const table of REFERENCE_TABLES) {
    let rows: unknown[]
    try {
      rows = await fetchAllRows<unknown>((from, to) =>
        admin.from(table).select('*').range(from, to) as unknown as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
      )
    } catch (error) {
      throw new Error(`No se pudieron leer las referencias de "${table}": ${error instanceof Error ? error.message : 'error'}. Escaneo cancelado.`)
    }
    for (const row of rows) {
      for (const path of extractReferencedPaths(JSON.stringify(row))) referenced.add(path)
    }
  }
  return referenced
}

export async function scanProductImageOrphans(): Promise<StorageScanResult> {
  const admin = createAdminSupabase()
  const [files, referenced] = await Promise.all([listBucket(admin), collectReferencedPaths(admin)])
  const cutoff = Date.now() - MIN_AGE_DAYS * 86_400_000

  const folderMap = new Map<string, { files: number; bytes: number }>()
  for (const file of files) {
    const folder = file.path.includes('/') ? file.path.split('/')[0] : '(raíz)'
    const entry = folderMap.get(folder) ?? { files: 0, bytes: 0 }
    entry.files += 1
    entry.bytes += file.size
    folderMap.set(folder, entry)
  }

  const selection = selectOrphanCandidates(files, referenced, cutoff)
  const skippedRecent = selection.skippedRecent
  const candidates: OrphanCandidate[] = selection.candidates.map((file) => ({
    ...file,
    publicUrl: admin.storage.from(CLEANUP_BUCKET).getPublicUrl(file.path).data.publicUrl,
  }))

  return {
    scannedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
    folders: [...folderMap.entries()]
      .map(([folder, v]) => ({ folder, ...v, protected: `${folder}/` !== CANDIDATE_PREFIX }))
      .sort((a, b) => b.files - a.files),
    referencedPaths: referenced.size,
    candidates,
    candidateBytes: candidates.reduce((sum, c) => sum + c.size, 0),
    skippedRecent,
    sources: [...REFERENCE_TABLES],
  }
}

/**
 * Borra solo las rutas pedidas que, en un escaneo nuevo hecho en este mismo
 * momento, siguen siendo candidatas. Lo que se haya empezado a usar entre el
 * escaneo y la confirmación se descarta.
 */
export async function deleteProductImageOrphans(requested: string[]): Promise<{ deleted: string[]; skipped: number }> {
  const scan = await scanProductImageOrphans()
  const allowed = new Set(scan.candidates.map((c) => c.path))
  const toDelete = [...new Set(requested)].filter((path) => allowed.has(path))
  const admin = createAdminSupabase()
  const deleted: string[] = []
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100)
    const { error } = await admin.storage.from(CLEANUP_BUCKET).remove(batch)
    if (error) throw new Error(`Falló el borrado de un lote: ${error.message}`)
    deleted.push(...batch)
  }
  return { deleted, skipped: requested.length - deleted.length }
}
