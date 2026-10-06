/**
 * Comprime las fotos viejas en JPG/PNG del bucket `product-images`.
 *
 * Desde que las imágenes de las tiendas se sirven directo (sin el optimizador
 * de Vercel), una foto de 2 MB llega tal cual al celular. Las que se suben hoy
 * ya salen en WebP liviano; este script hace lo mismo una sola vez con las
 * anteriores, con los mismos perfiles de subida (producto, banner, logo).
 *
 * Cada archivo se reescribe EN SU MISMA RUTA (con Content-Type image/webp),
 * así ninguna de las ~19 tablas que guardan la URL tiene que cambiar. Antes de
 * reescribir, el original se copia a `_respaldo-conversion/<fecha>/<ruta>` y
 * queda un manifiesto para volver atrás.
 *
 *   npx tsx scripts/compress-storage-images.ts            # solo muestra qué haría
 *   npx tsx scripts/compress-storage-images.ts --apply    # convierte
 *   npx tsx scripts/compress-storage-images.ts --restore 2026-10-06
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { optimizeServerImage } from '../src/lib/images/server-upload-optimizer'
import { PUBLIC_IMAGE_CACHE_CONTROL, type ImageUploadProfileName } from '../src/lib/images/upload-profiles'

config({ path: resolve(process.cwd(), '.env.local') })

const BUCKET = 'product-images'
const BACKUP_PREFIX = '_respaldo-conversion'
/** Más chicas que esto no valen el viaje. */
const MIN_BYTES = 150 * 1024
/** Si la versión nueva no ahorra al menos esto, se deja la original. */
const MIN_SAVING = 0.3
/** Carpetas que no se tocan: la marca de la plataforma, la papelera y los respaldos. */
const SKIP_PREFIXES = ['branding/', '_papelera/', `${BACKUP_PREFIX}/`]

const MIME_BY_EXTENSION: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png' }

type StorageFile = { path: string; size: number }
type ManifestEntry = { path: string; backup: string; before: number; after: number; profile: ImageUploadProfileName }

export function profileForPath(path: string): ImageUploadProfileName {
  if (/(^|\/)logos?\//.test(path) || path.startsWith('avatars/')) return 'logo'
  if (/^website\/(promotions|hero|media|banners?)\//.test(path) || path.startsWith('promotions/')) return 'banner'
  return 'product'
}

export function isCandidate(file: StorageFile): boolean {
  const extension = file.path.split('.').pop()?.toLowerCase() ?? ''
  return Boolean(MIME_BY_EXTENSION[extension])
    && file.size >= MIN_BYTES
    && !SKIP_PREFIXES.some((prefix) => file.path.startsWith(prefix))
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
type Admin = ReturnType<typeof client>

async function listAll(admin: Admin, folder = ''): Promise<StorageFile[]> {
  const files: StorageFile[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000, offset })
    if (error) throw new Error(`No se pudo listar ${folder || '/'}: ${error.message}`)
    for (const item of data ?? []) {
      const path = folder ? `${folder}/${item.name}` : item.name
      if (item.id === null) files.push(...(await listAll(admin, path)))
      else files.push({ path, size: Number((item.metadata as { size?: number } | null)?.size ?? 0) })
    }
    if ((data ?? []).length < 1000) break
  }
  return files
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`
const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

async function compress(apply: boolean) {
  const admin = client()
  const today = new Date().toISOString().slice(0, 10)
  const candidates = (await listAll(admin)).filter(isCandidate).sort((a, b) => b.size - a.size)
  console.log(`${candidates.length} fotos JPG/PNG de más de ${kb(MIN_BYTES)}${apply ? '' : ' (prueba: no se cambia nada)'}\n`)

  const manifest: ManifestEntry[] = []
  let before = 0
  let after = 0
  for (const file of candidates) {
    const profile = profileForPath(file.path)
    const extension = file.path.split('.').pop()!.toLowerCase()
    try {
      const { data: blob, error } = await admin.storage.from(BUCKET).download(file.path)
      if (error || !blob) throw new Error(error?.message ?? 'sin contenido')
      const input = Buffer.from(await blob.arrayBuffer())
      // El formato real, no el del nombre: hay «.jpg» que por dentro son PNG o WebP.
      const format = (await sharp(input).metadata()).format
      const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : MIME_BY_EXTENSION[extension]
      const optimized = await optimizeServerImage(input, mime, file.path, profile)
      if (optimized.buffer.byteLength > input.byteLength * (1 - MIN_SAVING)) {
        console.log(`  =  ${file.path}: ${kb(input.byteLength)} → ${kb(optimized.buffer.byteLength)} (no ahorra, queda igual)`)
        continue
      }
      console.log(`  ✓  ${file.path} [${profile}]: ${kb(input.byteLength)} → ${kb(optimized.buffer.byteLength)}`)
      before += input.byteLength
      after += optimized.buffer.byteLength
      if (!apply) continue

      const backup = `${BACKUP_PREFIX}/${today}/${file.path}`
      const { error: copyError } = await admin.storage.from(BUCKET).copy(file.path, backup)
      // Sin respaldo no se pisa el original.
      if (copyError && !/already exists/i.test(copyError.message)) throw new Error(`respaldo: ${copyError.message}`)
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(file.path, optimized.buffer, {
        upsert: true,
        contentType: optimized.mimeType,
        cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
      })
      if (uploadError) throw new Error(`subida: ${uploadError.message}`)
      manifest.push({ path: file.path, backup, before: input.byteLength, after: optimized.buffer.byteLength, profile })
    } catch (error) {
      console.log(`  ✗  ${file.path}: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log(`\nTotal: ${mb(before)} → ${mb(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% menos)`)
  if (apply && manifest.length) {
    const path = `${BACKUP_PREFIX}/${today}/manifest-${Date.now()}.json`
    await admin.storage.from(BUCKET).upload(path, Buffer.from(JSON.stringify(manifest, null, 2)), { contentType: 'application/json' })
    console.log(`Respaldo y manifiesto en ${BUCKET}/${path}`)
  }
}

async function restore(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Indicá la fecha del respaldo: --restore AAAA-MM-DD')
  const admin = client()
  const backups = (await listAll(admin, `${BACKUP_PREFIX}/${date}`)).filter((file) => !/manifest-\d+\.json$/.test(file.path))
  console.log(`${backups.length} originales para restaurar del ${date}`)
  const extensionMime = (path: string) => MIME_BY_EXTENSION[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'
  for (const backup of backups) {
    const original = backup.path.slice(`${BACKUP_PREFIX}/${date}/`.length)
    const { data: blob, error } = await admin.storage.from(BUCKET).download(backup.path)
    if (error || !blob) { console.log(`  ✗  ${original}: ${error?.message}`); continue }
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(original, Buffer.from(await blob.arrayBuffer()), {
      upsert: true, contentType: extensionMime(original), cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
    })
    console.log(uploadError ? `  ✗  ${original}: ${uploadError.message}` : `  ✓  ${original}`)
  }
}

if (process.argv[1]?.includes('compress-storage-images')) {
  const args = process.argv.slice(2)
  const restoreIndex = args.indexOf('--restore')
  const run = restoreIndex >= 0 ? restore(args[restoreIndex + 1] ?? '') : compress(args.includes('--apply'))
  run.catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
}
