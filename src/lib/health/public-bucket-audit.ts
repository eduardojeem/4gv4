import type { SupabaseClient } from '@supabase/supabase-js'

import type { HealthSeverity, HealthStatus } from '@/lib/health/types'

const INTENTIONAL_PUBLIC_IMAGE_BUCKETS = new Set(['product-images', 'avatars'])
const FORBIDDEN_PUBLIC_BUCKETS = new Set(['repair-images'])

type Bucket = { id: string; public: boolean }
type AuditOptions = { objectLimit?: number; pageSize?: number }

export type PublicBucketAudit = {
  status: HealthStatus
  severity: HealthSeverity
  summary: string
  findings: string[]
  recommendation?: string
  metadata: Record<string, string | number | boolean | null>
}

type ListedObject = {
  name: string
  id?: string | null
  metadata?: { mimetype?: string | null } | null
}

export async function auditPublicBuckets(
  admin: SupabaseClient,
  buckets: Bucket[],
  options: AuditOptions = {},
): Promise<PublicBucketAudit> {
  const objectLimit = Math.max(1, options.objectLimit ?? 200)
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 100, objectLimit))
  const publicBuckets = buckets.filter((bucket) => bucket.public)
  const forbidden = publicBuckets.filter((bucket) => FORBIDDEN_PUBLIC_BUCKETS.has(bucket.id))
  const unknown = publicBuckets.filter((bucket) => !(
    FORBIDDEN_PUBLIC_BUCKETS.has(bucket.id) || INTENTIONAL_PUBLIC_IMAGE_BUCKETS.has(bucket.id)
  ))
  const mimeCounts = new Map<string, number>()
  const nonImageBuckets = new Set<string>()
  const listFailures = new Set<string>()
  let inspectedObjects = 0
  let listingRequests = 0
  let truncated = false

  for (const bucket of publicBuckets) {
    if (inspectedObjects >= objectLimit) {
      truncated = true
      break
    }

    const directories = ['']
    while (directories.length > 0 && inspectedObjects < objectLimit && listingRequests < objectLimit * 2) {
      const directory = directories.shift() as string
      let offset = 0

      while (inspectedObjects < objectLimit && listingRequests < objectLimit * 2) {
        const remaining = objectLimit - inspectedObjects
        const limit = Math.min(pageSize, remaining)
        listingRequests += 1
        const { data, error } = await admin.storage.from(bucket.id).list(directory, {
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

        if (error) {
          listFailures.add(bucket.id)
          break
        }

        const rows = (data ?? []) as ListedObject[]
        for (const object of rows.slice(0, remaining)) {
          const mime = object.metadata?.mimetype?.toLowerCase()
          if (!mime) {
            directories.push(directory ? `${directory}/${object.name}` : object.name)
            continue
          }

          inspectedObjects += 1
          const family = mime.includes('/') ? `${mime.split('/')[0]}/*` : 'desconocido'
          mimeCounts.set(family, (mimeCounts.get(family) ?? 0) + 1)
          if (INTENTIONAL_PUBLIC_IMAGE_BUCKETS.has(bucket.id) && !mime.startsWith('image/')) {
            nonImageBuckets.add(bucket.id)
          }
          if (inspectedObjects >= objectLimit) break
        }

        if (rows.length >= limit && inspectedObjects >= objectLimit) {
          truncated = true
        }
        if (rows.length < limit || rows.length === 0) break
        offset += rows.length
      }
    }

    if (listingRequests >= objectLimit * 2) truncated = true
  }

  const mimeSummary = [...mimeCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([mime, total]) => `${mime}: ${total}`)
    .join(', ')

  const metadata = {
    publicBuckets: publicBuckets.length,
    privateBuckets: buckets.length - publicBuckets.length,
    inspectedObjects,
    truncated,
    mimeSummary: mimeSummary || 'sin archivos detectados',
  }

  if (forbidden.length > 0) {
    return {
      status: 'error',
      severity: 'high',
      summary: `${forbidden.length} bucket(s) de reparaciones expuesto(s) públicamente`,
      findings: forbidden.map((bucket) => (
        `El bucket "${bucket.id}" es público; se inspeccionaron solo conteos y tipos MIME.`
      )),
      recommendation: 'Hacer privado repair-images y servir cada archivo únicamente con una URL firmada después de autorizar la reparación.',
      metadata,
    }
  }

  if (listFailures.size > 0) {
    return {
      status: 'unknown',
      severity: 'medium',
      summary: `No se pudo inspeccionar ${listFailures.size} bucket(s) público(s)`,
      findings: [...listFailures].map((bucket) => `No se pudo listar el contenido agregado de "${bucket}".`),
      recommendation: 'Verificar que la service role del diagnóstico pueda listar de forma acotada los buckets públicos.',
      metadata,
    }
  }

  if (nonImageBuckets.size > 0) {
    return {
      status: 'error',
      severity: 'high',
      summary: `${nonImageBuckets.size} bucket(s) público(s) de imágenes contienen otros tipos de archivo`,
      findings: [...nonImageBuckets].map((bucket) => `"${bucket}" contiene al menos un tipo MIME no visual.`),
      recommendation: 'Revisar el contenido, mover archivos sensibles a buckets privados y restringir los MIME permitidos.',
      metadata,
    }
  }

  if (unknown.length > 0) {
    return {
      status: 'warning',
      severity: 'low',
      summary: `${unknown.length} bucket(s) público(s) sin clasificación explícita`,
      findings: unknown.map((bucket) => `Clasificar el propósito público de "${bucket.id}".`),
      recommendation: 'Documentar los buckets destinados a recursos anónimos o hacerlos privados.',
      metadata,
    }
  }

  return {
    status: 'healthy',
    severity: 'info',
    summary: publicBuckets.length === 0
      ? `Todos los ${buckets.length} buckets son privados`
      : `${publicBuckets.length} bucket(s) público(s) intencional(es), solo para imágenes`,
    findings: publicBuckets.map((bucket) => `Público intencional: ${bucket.id}`),
    metadata,
  }
}
