import { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import {
  CANDIDATE_PREFIX,
  CLEANUP_BUCKET,
  MAX_ORPHAN_SHARE,
  MIN_AGE_DAYS,
  TRASH_PREFIX,
  TRASH_RETENTION_DAYS,
} from '@/lib/superadmin/storage-cleanup-rules'

export { CANDIDATE_PREFIX, CLEANUP_BUCKET, MAX_ORPHAN_SHARE, MIN_AGE_DAYS, TRASH_PREFIX, TRASH_RETENTION_DAYS }

/**
 * Limpieza de imágenes de productos sin uso en el bucket `product-images`.
 *
 * La versión anterior (src/services/storage-cleanup-service.ts) comparaba todo
 * el bucket solo contra `products` y desde el navegador: marcaba como
 * huérfanos el logo y el favicon de la plataforma, los logos de las tiendas y
 * los medios del sitio, y, por RLS, también imágenes de productos de tiendas a
 * las que el SuperAdmin no pertenece. Medido el 2026-09-27: 46 archivos en uso
 * marcados para borrar.
 *
 * Reglas (todas en el servidor, con la service role):
 *  1. Solo son candidatos los archivos de `products/`. `branding/`, `logos/`,
 *     `website/` y cualquier otra carpeta nunca se proponen.
 *  2. Un archivo está en uso si su ruta aparece en CUALQUIER columna de las
 *     tablas de REFERENCE_TABLES (se busca en el JSON de la fila completa).
 *  3. También está en uso si es el original de una versión que sí se usa:
 *     el producto muestra `abc-optimized.webp` y `abc.jpeg` es la foto que
 *     subió el negocio. Medido el 2026-10-01: 6 originales así se proponían.
 *  4. Nunca se proponen archivos modificados en los últimos MIN_AGE_DAYS días
 *     (pueden pertenecer a un formulario que todavía no se guardó).
 *  5. Si alguna fuente de referencias falla, el escaneo se cancela: jamás se
 *     decide con información parcial.
 *  6. Freno: si «sin uso» supera MAX_ORPHAN_SHARE de las imágenes, lo más
 *     probable es que falte una fuente de referencias, no que sobren fotos.
 *     Se muestra el análisis pero no se deja mover nada.
 *  7. Nada se borra directamente: va a la papelera (`_papelera/`), se puede
 *     restaurar, y recién después de TRASH_RETENTION_DAYS se puede vaciar.
 */
/** Con pocas imágenes el porcentaje no dice nada. */
const BRAKE_MIN_FILES = 20
const MAX_FILES_PER_OPERATION = 500

const REFERENCE_TABLES = [
  'products',
  'product_variants',
  'brands',
  'global_brands',
  'categories',
  'global_categories',
  // La foto de una ficha del catálogo puede ser la que subió una tienda.
  'global_products',
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

/** Tablas que se crean con un SQL aparte y pueden no existir todavía. */
const OPTIONAL_REFERENCE_TABLES = new Set<string>(['global_products'])

/** Ruta dentro del bucket, con o sin la URL pública delante. */
const PATH_PATTERN = /(?:product-images\/)?(products\/[A-Za-z0-9._~%\-/]+)/g

/** Sufijos con los que se guardan versiones derivadas de una misma foto. */
const VARIANT_SUFFIX = /[-_](?:optimized|thumb|thumbnail|small|medium|large|resized|compressed)(?:[-_.].*)?$/i

export interface OrphanCandidate {
  path: string
  size: number
  updatedAt: string | null
  publicUrl: string
}

export interface TrashEntry {
  path: string
  originalPath: string
  trashedOn: string
  size: number
  publicUrl: string
  /** Desde cuándo se puede borrar definitivamente. */
  purgeableAt: string
  /** Algo volvió a usar la ruta original: hay que restaurarla, no borrarla. */
  inUse: boolean
}

/** Una foto que algo usa pero cuyo archivo no está: se ve rota en la tienda. */
export interface MissingImage {
  path: string
  tables: string[]
  stores: Array<{ id: string; name: string; slug: string | null }>
}

export interface StorageScanResult {
  scannedAt: string
  totalFiles: number
  totalBytes: number
  productFiles: number
  folders: Array<{ folder: string; files: number; bytes: number; protected: boolean }>
  referencedPaths: number
  candidates: OrphanCandidate[]
  candidateBytes: number
  skippedRecent: number
  /** Originales de fotos en uso que se protegen por la regla 3. */
  protectedVariants: number
  /** Regla 6: si está activo no se puede mover nada a la papelera. */
  brake: { tripped: boolean; share: number }
  trash: TrashEntry[]
  trashBytes: number
  missing: MissingImage[]
  sources: string[]
}

export type StorageFile = { path: string; size: number; updatedAt: string | null }
type Admin = ReturnType<typeof createAdminSupabase>

async function listBucket(admin: Admin, folder = ''): Promise<StorageFile[]> {
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
  // Una URL dentro de otra (p. ej. /_next/image?url=…) llega con las barras codificadas.
  const source = /%2f/i.test(text) ? `${text} ${text.replace(/%2f/gi, '/')}` : text
  const paths: string[] = []
  for (const match of source.matchAll(PATH_PATTERN)) {
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

/** `products/abc-optimized-2026.webp` y `products/abc.jpeg` son la misma foto: `products/abc`. */
export function imageFamily(path: string): string {
  const slash = path.lastIndexOf('/')
  const dir = path.slice(0, slash + 1)
  const stem = path.slice(slash + 1).replace(/\.[A-Za-z0-9]+$/, '')
  return `${dir}${stem.replace(VARIANT_SUFFIX, '')}`
}

/** Reglas 1, 3 y 4: solo `products/`, sin uso, sin versiones en uso y con más de MIN_AGE_DAYS. */
export function selectOrphanCandidates(files: StorageFile[], referenced: Set<string>, cutoffMs: number) {
  const referencedFamilies = new Set([...referenced].map(imageFamily))
  let skippedRecent = 0
  let protectedVariants = 0
  const candidates: StorageFile[] = []
  for (const file of files) {
    if (!file.path.startsWith(CANDIDATE_PREFIX) || referenced.has(file.path)) continue
    if (referencedFamilies.has(imageFamily(file.path))) {
      protectedVariants += 1
      continue
    }
    if (!file.updatedAt || Date.parse(file.updatedAt) > cutoffMs) {
      skippedRecent += 1
      continue
    }
    candidates.push(file)
  }
  candidates.sort((a, b) => b.size - a.size)
  return { candidates, skippedRecent, protectedVariants }
}

/** Regla 6. */
export function orphanBrake(candidates: number, productFiles: number) {
  const share = productFiles > 0 ? candidates / productFiles : 0
  return { tripped: productFiles >= BRAKE_MIN_FILES && share > MAX_ORPHAN_SHARE, share }
}

/** `_papelera/2026-10-01/products/abc.jpg` ↔ `products/abc.jpg` movida el 2026-10-01. */
export function trashPathFor(path: string, now = new Date()): string {
  return `${TRASH_PREFIX}${now.toISOString().slice(0, 10)}/${path}`
}

export function parseTrashPath(path: string): { originalPath: string; trashedOn: string } | null {
  const match = path.match(/^_papelera\/(\d{4}-\d{2}-\d{2})\/(products\/.+)$/)
  return match ? { trashedOn: match[1], originalPath: match[2] } : null
}

export function purgeableAt(trashedOn: string): Date {
  return new Date(Date.parse(`${trashedOn}T00:00:00Z`) + TRASH_RETENTION_DAYS * 86_400_000)
}

type ReferenceInfo = { tables: Set<string>; orgIds: Set<string> }

async function collectReferences(admin: Admin): Promise<Map<string, ReferenceInfo>> {
  const references = new Map<string, ReferenceInfo>()
  for (const table of REFERENCE_TABLES) {
    let rows: unknown[]
    try {
      rows = await fetchAllRows<unknown>((from, to) =>
        admin.from(table).select('*').range(from, to) as unknown as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      // Una tabla opcional que todavía no se creó no referencia nada: saltearla
      // no puede marcar como huérfano un archivo en uso.
      if (OPTIONAL_REFERENCE_TABLES.has(table) && /does not exist|could not find/i.test(message)) continue
      throw new Error(`No se pudieron leer las referencias de "${table}": ${message}. Escaneo cancelado.`)
    }
    for (const row of rows) {
      const orgId = (row as { organization_id?: unknown }).organization_id
      for (const path of extractReferencedPaths(JSON.stringify(row))) {
        const info = references.get(path) ?? { tables: new Set<string>(), orgIds: new Set<string>() }
        info.tables.add(table)
        if (typeof orgId === 'string') info.orgIds.add(orgId)
        references.set(path, info)
      }
    }
  }
  return references
}

async function describeMissing(admin: Admin, references: Map<string, ReferenceInfo>, missingPaths: string[]): Promise<MissingImage[]> {
  const orgIds = [...new Set(missingPaths.flatMap((path) => [...(references.get(path)?.orgIds ?? [])]))]
  const names = new Map<string, { id: string; name: string; slug: string | null }>()
  if (orgIds.length) {
    const { data } = await admin.from('organizations').select('id, name, slug').in('id', orgIds)
    for (const org of (data ?? []) as Array<{ id: string; name: string; slug: string | null }>) names.set(org.id, org)
  }
  return missingPaths.map((path) => {
    const info = references.get(path)
    return {
      path,
      tables: [...(info?.tables ?? [])],
      stores: [...(info?.orgIds ?? [])].map((id) => names.get(id) ?? { id, name: 'Tienda desconocida', slug: null }),
    }
  }).sort((a, b) => (a.stores[0]?.name ?? '').localeCompare(b.stores[0]?.name ?? '', 'es') || a.path.localeCompare(b.path))
}

export async function scanProductImageOrphans(now = new Date()): Promise<StorageScanResult> {
  const admin = createAdminSupabase()
  const [files, references] = await Promise.all([listBucket(admin), collectReferences(admin)])
  const referenced = new Set(references.keys())
  const publicUrl = (path: string) => admin.storage.from(CLEANUP_BUCKET).getPublicUrl(path).data.publicUrl

  const live = files.filter((file) => !file.path.startsWith(TRASH_PREFIX))
  const folderMap = new Map<string, { files: number; bytes: number }>()
  for (const file of live) {
    const folder = file.path.includes('/') ? file.path.split('/')[0] : '(raíz)'
    const entry = folderMap.get(folder) ?? { files: 0, bytes: 0 }
    entry.files += 1
    entry.bytes += file.size
    folderMap.set(folder, entry)
  }

  const selection = selectOrphanCandidates(live, referenced, now.getTime() - MIN_AGE_DAYS * 86_400_000)
  const candidates: OrphanCandidate[] = selection.candidates.map((file) => ({ ...file, publicUrl: publicUrl(file.path) }))
  const productFiles = live.filter((file) => file.path.startsWith(CANDIDATE_PREFIX)).length

  const referencedFamilies = new Set([...referenced].map(imageFamily))
  const trash: TrashEntry[] = files.flatMap((file) => {
    const parsed = parseTrashPath(file.path)
    if (!parsed) return []
    return [{
      path: file.path,
      ...parsed,
      size: file.size,
      publicUrl: publicUrl(file.path),
      purgeableAt: purgeableAt(parsed.trashedOn).toISOString(),
      inUse: referenced.has(parsed.originalPath) || referencedFamilies.has(imageFamily(parsed.originalPath)),
    }]
  }).sort((a, b) => a.trashedOn.localeCompare(b.trashedOn))

  // Lo que está en la papelera ya se avisa ahí («volvió a usarse»).
  const present = new Set([...live.map((file) => file.path), ...trash.map((entry) => entry.originalPath)])
  const missing = await describeMissing(admin, references, [...referenced].filter((path) => !present.has(path)))

  return {
    scannedAt: now.toISOString(),
    totalFiles: live.length,
    totalBytes: live.reduce((sum, f) => sum + f.size, 0),
    productFiles,
    folders: [...folderMap.entries()]
      .map(([folder, v]) => ({ folder, ...v, protected: `${folder}/` !== CANDIDATE_PREFIX }))
      .sort((a, b) => b.files - a.files),
    referencedPaths: referenced.size,
    candidates,
    candidateBytes: candidates.reduce((sum, c) => sum + c.size, 0),
    skippedRecent: selection.skippedRecent,
    protectedVariants: selection.protectedVariants,
    brake: orphanBrake(candidates.length, productFiles),
    trash,
    trashBytes: trash.reduce((sum, t) => sum + t.size, 0),
    missing,
    sources: [...REFERENCE_TABLES],
  }
}

function uniqueRequested(requested: string[]) {
  const paths = [...new Set(requested.filter((path) => typeof path === 'string'))]
  if (paths.length > MAX_FILES_PER_OPERATION) throw new Error(`Máximo ${MAX_FILES_PER_OPERATION} archivos por operación`)
  return paths
}

/**
 * Mueve a la papelera solo las rutas pedidas que, en un escaneo nuevo hecho en
 * este momento, siguen sin uso. Lo que empezó a usarse entretanto se omite.
 */
export async function trashProductImageOrphans(requested: string[]): Promise<{ moved: string[]; skipped: number }> {
  const paths = uniqueRequested(requested)
  const scan = await scanProductImageOrphans()
  if (scan.brake.tripped) {
    throw new Error(`Freno de seguridad: el ${Math.round(scan.brake.share * 100)}% de las imágenes figura sin uso. Revisá las fuentes de referencias antes de mover nada.`)
  }
  const allowed = new Set(scan.candidates.map((c) => c.path))
  const admin = createAdminSupabase()
  const moved: string[] = []
  for (const path of paths.filter((p) => allowed.has(p))) {
    const { error } = await admin.storage.from(CLEANUP_BUCKET).move(path, trashPathFor(path))
    if (error) throw new Error(`No se pudo mover ${path} a la papelera (${moved.length} ya movidos): ${error.message}`)
    moved.push(path)
  }
  return { moved, skipped: requested.length - moved.length }
}

/** Devuelve archivos de la papelera a su lugar. Si la ruta original ya está ocupada, se deja. */
export async function restoreTrashedImages(requested: string[]): Promise<{ restored: string[]; failed: string[] }> {
  const admin = createAdminSupabase()
  const restored: string[] = []
  const failed: string[] = []
  for (const path of uniqueRequested(requested)) {
    const parsed = parseTrashPath(path)
    if (!parsed) {
      failed.push(path)
      continue
    }
    const { error } = await admin.storage.from(CLEANUP_BUCKET).move(path, parsed.originalPath)
    if (error) failed.push(path)
    else restored.push(parsed.originalPath)
  }
  return { restored, failed }
}

/**
 * Borra definitivamente lo pedido, pero solo lo que lleva más de
 * TRASH_RETENTION_DAYS en la papelera y nadie volvió a usar.
 */
export async function purgeImageTrash(requested: string[], now = new Date()): Promise<{ deleted: string[]; skipped: number }> {
  const paths = uniqueRequested(requested)
  const scan = await scanProductImageOrphans(now)
  const allowed = new Set(
    scan.trash.filter((entry) => !entry.inUse && Date.parse(entry.purgeableAt) <= now.getTime()).map((entry) => entry.path),
  )
  const toDelete = paths.filter((path) => allowed.has(path))
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
