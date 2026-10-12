import 'server-only'
import { z } from 'zod'
import type { TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { CreditDocumentType, CreditFileDTO } from './credit-file-contract'
import { CreditFileError, creditFileCustomer, requireCreditFileRole, throwCreditFileDatabaseError } from './credit-file-server'

const bucket = 'customer-credit-documents'
export const MAX_CREDIT_DOCUMENT_BYTES = 4 * 1024 * 1024
const MAX_BODY_BYTES = 4_300_000
const uuid = z.string().uuid()
export const CreditDocumentReviewSchema = z.object({ version: z.number().int().min(0), reviewStatus: z.enum(['pending', 'verified', 'rejected']), comment: z.string().trim().max(1000).default('') }).strict()
export const CreditDocumentDeleteSchema = z.object({ version: z.number().int().min(0) }).strict()

export function validateCreditDocument(bytes: Uint8Array, declaredType: string): { mimeType: string; extension: string } {
  if (!bytes.length || bytes.length > MAX_CREDIT_DOCUMENT_BYTES) throw new CreditFileError('INVALID_DOCUMENT_SIZE', 413, 'Elegí una imagen de hasta 4 MB, no vacía.')
  const match = (offset: number, signature: number[]) => signature.every((value, i) => bytes[offset + i] === value)
  const detected = match(0, [255,216,255]) ? { mimeType: 'image/jpeg', extension: 'jpg' }
    : match(0, [137,80,78,71,13,10,26,10]) ? { mimeType: 'image/png', extension: 'png' }
    : match(0, [82,73,70,70]) && match(8, [87,69,66,80]) ? { mimeType: 'image/webp', extension: 'webp' } : null
  if (!detected || detected.mimeType !== declaredType) throw new CreditFileError('INVALID_DOCUMENT_TYPE', 400, 'Solo JPEG, PNG o WebP con contenido válido. PDF no está habilitado.')
  return detected
}

/** Bound memory even when Content-Length is missing or forged. */
export async function readCreditDocumentForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader()
  if (!reader) throw new CreditFileError('INVALID_DOCUMENT_BODY', 400, 'Seleccioná un archivo.')
  let length = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new CreditFileError('DOCUMENT_BODY_TOO_LARGE', 413, 'La carga supera el máximo de 4 MB por archivo.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData() }
  catch { throw new CreditFileError('INVALID_DOCUMENT_BODY', 400, 'La carga del archivo no es válida.') }
}

async function authorized(context: TenantAuthContext, customerId: string) {
  requireCreditFileRole(context)
  const client = createAdminSupabase()
  await creditFileCustomer(client, context.organization.id, customerId)
  return client
}
type Client = ReturnType<typeof createAdminSupabase>
async function change(client: Client, context: TenantAuthContext, customerId: string, documentId: string, action: string, version: number | null, reviewStatus: string | null = null, comment: string | null = null) {
  const { data, error } = await client.rpc('change_customer_credit_document', { p_organization_id: context.organization.id, p_customer_id: customerId, p_actor_id: context.user.id, p_document_id: documentId, p_expected_version: version, p_action: action, p_review_status: reviewStatus, p_comment: comment })
  if (error) throwCreditFileDatabaseError(error)
  return data as CreditFileDTO
}
async function document(client: Client, context: TenantAuthContext, customerId: string, documentId: string) {
  if (!uuid.safeParse(documentId).success) throw new CreditFileError('INVALID_DOCUMENT_ID', 400, 'Documento inválido.')
  const { data, error } = await client.from('customer_credit_documents').select('id, object_path, mime_type, filename, lifecycle, byte_size, cleanup_pending').eq('organization_id', context.organization.id).eq('customer_id', customerId).eq('id', documentId).maybeSingle()
  if (error) throwCreditFileDatabaseError(error)
  if (!data) throw new CreditFileError('DOCUMENT_NOT_FOUND', 404, 'Documento no encontrado.')
  return data
}
async function cleanup(client: Client, context: TenantAuthContext, customerId: string, documentId: string, path: string) {
  try {
    const { error } = await client.storage.from(bucket).remove([path])
    if (error) return false
    await change(client, context, customerId, documentId, 'cleaned', null)
    return true
  } catch { return false }
}
export async function uploadCreditDocument(context: TenantAuthContext, customerId: string, file: File, type: CreditDocumentType, expectedVersion: number): Promise<CreditFileDTO> {
  const client = await authorized(context, customerId)
  if (!file.size || file.size > MAX_CREDIT_DOCUMENT_BYTES) throw new CreditFileError('INVALID_DOCUMENT_SIZE', 413, 'Elegí una imagen de hasta 4 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { mimeType, extension } = validateCreditDocument(bytes, file.type)
  const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || `documento.${extension}`
  const reservation = await client.rpc('reserve_customer_credit_document', { p_organization_id: context.organization.id, p_customer_id: customerId, p_actor_id: context.user.id, p_expected_version: expectedVersion, p_type: type, p_filename: filename, p_mime_type: mimeType, p_byte_size: bytes.length, p_extension: extension })
  if (reservation.error) throwCreditFileDatabaseError(reservation.error)
  const reserved = reservation.data as { id: string; objectPath: string }
  try {
    const uploaded = await client.storage.from(bucket).upload(reserved.objectPath, bytes, { contentType: mimeType, upsert: false })
    if (uploaded.error) throw new CreditFileError('DOCUMENT_UPLOAD_FAILED', 502, 'No se pudo cargar la imagen. Recargá la ficha y reintentá.')
    return await change(client, context, customerId, reserved.id, 'ready', null)
  } catch (error) {
    try {
      const current = await client.rpc('customer_credit_file_dto', { p_organization_id: context.organization.id, p_customer_id: customerId })
      if (current.error) throwCreditFileDatabaseError(current.error)
      await change(client, context, customerId, reserved.id, 'delete', (current.data as CreditFileDTO).version)
      await cleanup(client, context, customerId, reserved.id, reserved.objectPath)
    } catch { /* Retain pending/deleted metadata for cleanup retry; no private paths in logs. */ }
    throw error
  }
}
export async function downloadCreditDocument(context: TenantAuthContext, customerId: string, documentId: string) {
  const client = await authorized(context, customerId)
  const row = await document(client, context, customerId, documentId)
  if (row.lifecycle !== 'ready') throw new CreditFileError('DOCUMENT_NOT_FOUND', 404, 'El documento no está disponible.')
  if (row.byte_size > MAX_CREDIT_DOCUMENT_BYTES) throw new CreditFileError('LEGACY_DOCUMENT_TOO_LARGE', 413, 'Este archivo anterior supera 4 MB. Solicitá una copia más liviana al administrador.')
  const downloaded = await client.storage.from(bucket).download(row.object_path)
  if (downloaded.error || !downloaded.data) throw new CreditFileError('DOCUMENT_DOWNLOAD_FAILED', 502, 'No se pudo descargar el documento.')
  if (downloaded.data.size > MAX_CREDIT_DOCUMENT_BYTES) throw new CreditFileError('INVALID_DOCUMENT_SIZE', 413, 'El archivo almacenado supera 4 MB. Solicitá una copia más liviana.')
  if ((await document(client, context, customerId, documentId)).lifecycle !== 'ready') throw new CreditFileError('DOCUMENT_NOT_FOUND', 404, 'El documento fue retirado.')
  return { bytes: new Uint8Array(await downloaded.data.arrayBuffer()), mimeType: row.mime_type as string, filename: row.filename as string }
}
export async function reviewCreditDocument(context: TenantAuthContext, customerId: string, documentId: string, input: z.infer<typeof CreditDocumentReviewSchema>) {
  const client = await authorized(context, customerId)
  await document(client, context, customerId, documentId)
  return change(client, context, customerId, documentId, 'review', input.version, input.reviewStatus, input.comment)
}
export async function deleteCreditDocument(context: TenantAuthContext, customerId: string, documentId: string, expectedVersion: number) {
  const client = await authorized(context, customerId)
  const row = await document(client, context, customerId, documentId)
  const file = await change(client, context, customerId, documentId, 'delete', expectedVersion)
  const cleaned = await cleanup(client, context, customerId, documentId, row.object_path)
  return { file, cleanupPending: !cleaned }
}
export async function retryCreditDocumentCleanup(context: TenantAuthContext, customerId: string) {
  const client = await authorized(context, customerId)
  const { data, error } = await client.from('customer_credit_documents').select('id, object_path').eq('organization_id', context.organization.id).eq('customer_id', customerId).eq('lifecycle', 'deleted').eq('cleanup_pending', true).limit(10)
  if (error) throwCreditFileDatabaseError(error)
  let cleanupPending = (data?.length ?? 0) === 10
  for (const row of data ?? []) if (!await cleanup(client, context, customerId, row.id, row.object_path)) cleanupPending = true
  return { cleanupPending }
}
