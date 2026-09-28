/**
 * Tipos y utilidades de documentos legales sin dependencias de servidor:
 * los usa tanto el editor (Client Component) como las páginas y acciones.
 */
export const LEGAL_DOCUMENT_TYPES = ['privacy', 'terms'] as const
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number]
export type LegalDocumentStatus = 'draft' | 'published' | 'archived'

export const LEGAL_DOCUMENT_META: Record<LegalDocumentType, { label: string; path: string }> = {
  privacy: { label: 'Política de privacidad', path: '/saas/privacidad' },
  terms: { label: 'Términos y condiciones', path: '/saas/terminos' },
}

export interface LegalDocument {
  id: string
  documentType: LegalDocumentType
  version: number
  title: string
  content: string
  status: LegalDocumentStatus
  changeSummary: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

/** Marcadores que el texto base deja para completar; bloquean la publicación. */
const PLACEHOLDER = /\[(COMPLETAR|RAZÓN SOCIAL|RAZON SOCIAL|RUC|DOMICILIO|EMAIL|FECHA)[^\]]*\]/i

export function findPlaceholders(content: string): string[] {
  return [...new Set(content.match(new RegExp(PLACEHOLDER.source, 'gi')) ?? [])]
}

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export type LegalDocumentsState =
  | { available: true; documents: LegalDocument[] }
  | { available: false; reason: string }
