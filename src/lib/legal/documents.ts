import { unstable_cache } from 'next/cache'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { LegalDocument, LegalDocumentsState, LegalDocumentType, LegalDocumentStatus } from '@/lib/legal/shared'

export * from '@/lib/legal/shared'

/**
 * Documentos legales de la plataforma (tabla public.legal_documents).
 *
 * Cada documento tiene versiones: se edita un borrador, se revisa y se publica.
 * Publicar archiva la versión vigente (RPC publish_legal_document, atómica),
 * así queda registro de qué texto regía en cada fecha.
 */
type Row = {
  id: string
  document_type: LegalDocumentType
  version: number
  title: string
  content: string
  status: LegalDocumentStatus
  change_summary: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export const LEGAL_DOCUMENTS_TAG = 'legal-documents'
const COLUMNS = 'id, document_type, version, title, content, status, change_summary, created_at, updated_at, published_at'

function toDocument(row: Row): LegalDocument {
  return {
    id: row.id,
    documentType: row.document_type,
    version: row.version,
    title: row.title,
    content: row.content,
    status: row.status,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

/** Versión publicada (cacheada; se invalida al publicar). */
export const getPublishedLegalDocument = unstable_cache(
  async (documentType: LegalDocumentType): Promise<LegalDocument | null> => {
    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('legal_documents')
      .select(COLUMNS)
      .eq('document_type', documentType)
      .eq('status', 'published')
      .maybeSingle()
    if (error || !data) return null
    return toDocument(data as Row)
  },
  ['legal-document-published'],
  { tags: [LEGAL_DOCUMENTS_TAG], revalidate: 3600 },
)

/** Todas las versiones, para el editor de SuperAdmin (sin caché). */
export async function listLegalDocuments(): Promise<LegalDocumentsState> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('legal_documents')
    .select(COLUMNS)
    .order('document_type')
    .order('version', { ascending: false })
  if (error) {
    const missing = error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find/i.test(error.message)
    return {
      available: false,
      reason: missing
        ? 'La tabla legal_documents no existe todavía. Ejecutá el SQL de documentos legales en Supabase.'
        : `No se pudieron leer los documentos: ${error.message}`,
    }
  }
  return { available: true, documents: ((data ?? []) as Row[]).map(toDocument) }
}
