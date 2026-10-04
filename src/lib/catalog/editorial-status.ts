import { z } from 'zod'

export const CATALOG_STATUSES = ['candidate', 'review', 'published', 'inactive'] as const
export type CatalogStatus = (typeof CATALOG_STATUSES)[number]
export const catalogStatusSchema = z.enum(CATALOG_STATUSES)

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  candidate: 'Candidato', review: 'En revisión', published: 'Publicado', inactive: 'Inactivo',
}

const TRANSITIONS: Record<CatalogStatus, CatalogStatus[]> = {
  candidate: ['review'],
  review: ['published', 'candidate'],
  published: ['inactive', 'review'],
  inactive: ['review'],
}

export function canTransitionCatalogStatus(from: CatalogStatus, to: CatalogStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}
