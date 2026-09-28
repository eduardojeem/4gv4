'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import {
  LEGAL_DOCUMENTS_TAG,
  LEGAL_DOCUMENT_META,
  LEGAL_DOCUMENT_TYPES,
  findPlaceholders,
} from '@/lib/legal/documents'

export type LegalActionResult = { ok: true } | { ok: false; error: string }

const draftSchema = z.object({
  documentType: z.enum(LEGAL_DOCUMENT_TYPES),
  /** Borrador existente a actualizar; vacío crea una versión nueva. */
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, 'El título es obligatorio').max(160),
  content: z.string().trim().min(50, 'El contenido es demasiado corto').max(60_000),
  changeSummary: z.string().trim().max(500).optional().default(''),
})

function revalidateLegal() {
  revalidateTag(LEGAL_DOCUMENTS_TAG, 'max')
  for (const meta of Object.values(LEGAL_DOCUMENT_META)) revalidatePath(meta.path)
  revalidatePath('/superadmin/web-content/legal')
}

export async function saveLegalDraftAction(input: z.input<typeof draftSchema>): Promise<LegalActionResult> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }

  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { documentType, id, title, content, changeSummary } = parsed.data
  const admin = createAdminSupabase()

  if (id) {
    // Solo los borradores son editables: lo publicado y archivado es histórico.
    const { data, error } = await admin
      .from('legal_documents')
      .update({ title, content, change_summary: changeSummary || null, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id)
      .eq('document_type', documentType)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle()
    if (error) return { ok: false, error: 'No se pudo guardar el borrador.' }
    if (!data) return { ok: false, error: 'El borrador ya no existe o fue publicado. Recargá la página.' }
  } else {
    const { data: latest } = await admin
      .from('legal_documents')
      .select('version, status')
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if ((latest as { status?: string } | null)?.status === 'draft') {
      return { ok: false, error: 'Ya hay un borrador abierto para este documento. Editá ese.' }
    }
    const { error } = await admin.from('legal_documents').insert({
      document_type: documentType,
      version: ((latest as { version?: number } | null)?.version ?? 0) + 1,
      title,
      content,
      change_summary: changeSummary || null,
      status: 'draft',
      created_by: user.id,
      updated_by: user.id,
    })
    if (error) return { ok: false, error: 'No se pudo crear el borrador.' }
  }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'update',
    resource: 'legal_documents',
    resourceId: id ?? null,
    newValues: { document_type: documentType, status: 'draft' },
    severity: 'low',
  })
  revalidateLegal()
  return { ok: true }
}

export async function publishLegalDocumentAction(id: string): Promise<LegalActionResult> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Documento inválido' }

  const admin = createAdminSupabase()
  const { data: draft } = await admin
    .from('legal_documents')
    .select('document_type, version, content, status')
    .eq('id', id)
    .maybeSingle()
  const row = draft as { document_type: string; version: number; content: string; status: string } | null
  if (!row || row.status !== 'draft') return { ok: false, error: 'Solo se puede publicar un borrador.' }

  const placeholders = findPlaceholders(row.content)
  if (placeholders.length > 0) {
    return { ok: false, error: `Completá los datos pendientes antes de publicar: ${placeholders.join(', ')}` }
  }

  const { error } = await admin.rpc('publish_legal_document', { p_document_id: id, p_actor_id: user.id })
  if (error) return { ok: false, error: 'No se pudo publicar. Revisá que el SQL de documentos legales esté aplicado.' }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'publish',
    resource: 'legal_documents',
    resourceId: id,
    newValues: { document_type: row.document_type, version: row.version },
    severity: 'medium',
  })
  revalidateLegal()
  return { ok: true }
}
