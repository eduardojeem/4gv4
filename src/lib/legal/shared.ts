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

/**
 * Qué datos del responsable no aparecen en el texto. El texto base no nombra
 * a nadie ("La plataforma opera como prestador..."): sin razón social, RUC,
 * domicilio ni un correo, el lector no sabe con quién contrata ni a quién
 * pedirle sus datos. Es un aviso para el editor, no bloquea la publicación.
 */
export function responsibleDataGaps(content: string): string[] {
  const gaps: string[] = []
  if (!/raz[oó]n social/i.test(content)) gaps.push('razón social')
  if (!/\bRUC\b[^\n]{0,40}\d{4,}/i.test(content)) gaps.push('RUC')
  if (!/domicilio/i.test(content)) gaps.push('domicilio')
  if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(content)) gaps.push('correo de contacto')
  return gaps
}

/**
 * Sección para identificar al responsable. Los marcadores entre corchetes
 * bloquean la publicación hasta que se reemplazan por los datos reales.
 */
export function responsibleSection(documentType: LegalDocumentType): string {
  const heading = documentType === 'privacy' ? '## Responsable del tratamiento' : '## Quién presta el servicio'
  return `${heading}

- **Razón social:** [RAZÓN SOCIAL]
- **RUC:** [RUC]
- **Domicilio:** [DOMICILIO]
- **Correo de contacto:** [EMAIL de contacto]`
}

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export type LegalDocumentsState =
  | { available: true; documents: LegalDocument[] }
  | { available: false; reason: string }
