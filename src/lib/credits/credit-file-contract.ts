import { z } from 'zod'

export type CreditFileStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
export type CreditFileMode = 'informational' | 'warning' | 'required'
export type CreditDocumentType = 'identity' | 'address' | 'income' | 'other'
export type CreditFileReference = {
  id: string; name: string; relationship: string; phone: string
  verificationStatus: 'pending' | 'verified' | 'unreachable'
  verifiedAt: string | null; verifiedBy: string | null; comment: string
}
export type CreditFileDocument = {
  id: string; type: CreditDocumentType; filename: string
  lifecycle: 'pending' | 'ready' | 'deleted'; reviewStatus: 'pending' | 'verified' | 'rejected'
  reviewedAt: string | null; reviewedBy: string | null; comment: string
}
export type CreditFileDTO = {
  version: number; status: CreditFileStatus
  identity: { type: 'ci' | 'ruc' | 'other'; number: string }
  occupation: string; company: string; position: string; declaredMonthlyIncome: number | null
  informedCustomerAt: string | null; references: CreditFileReference[]; documents: CreditFileDocument[]
  lastDecision: { actorId: string; at: string; reason: string } | null
}
export type CreditFilePolicy = {
  version: number; mode: CreditFileMode; requireIdentity: boolean; minVerifiedReferences: number
  requiredDocuments: CreditDocumentType[]
}
export type CreditFileSummary = {
  status: CreditFileStatus | null; mode: CreditFileMode; missing: string[]; limit: number
  outstanding: number; available: number; overdueCount: number; eligible: boolean
}

const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const money = z.number().finite().min(0).max(1_000_000_000_000)
const documentType = z.enum(['identity', 'address', 'income', 'other'])
const referenceInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(50),
  verificationStatus: z.enum(['pending', 'verified', 'unreachable']),
  comment: z.string().trim().max(1000).default(''),
}).strict()

// Documents, approval and audit fields are controlled by separate server actions.
export const CreditFileInputSchema = z.object({
  version,
  identity: z.object({ type: z.enum(['ci', 'ruc', 'other']), number: z.string().trim().max(50) }).strict(),
  occupation: z.string().trim().max(200).default(''),
  company: z.string().trim().max(200).default(''),
  position: z.string().trim().max(120).default(''),
  declaredMonthlyIncome: z.preprocess(value => value === '' || value === undefined ? null : value, money.nullable()),
  informedCustomer: z.boolean(),
  references: z.array(referenceInput).max(5).refine(references => {
    const ids = references.flatMap(reference => reference.id ? [reference.id] : [])
    return new Set(ids).size === ids.length
  }, 'Una referencia no puede aparecer dos veces.'),
}).strict()

export const CreditFileDecisionSchema = z.object({
  version,
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
  limit: money.optional(),
  reason: z.string().trim().min(1).max(1000),
}).strict().refine(input => input.status !== 'approved' || input.limit !== undefined, {
  message: 'Ingresá el límite autorizado.', path: ['limit'],
})

export const CreditFilePolicySchema = z.object({
  version: version.default(0),
  mode: z.enum(['informational', 'warning', 'required']).default('informational'),
  requireIdentity: z.boolean().default(false),
  minVerifiedReferences: z.number().int().min(0).max(5).default(0),
  requiredDocuments: z.array(documentType).max(4).default([])
    .refine(types => new Set(types).size === types.length, 'No repitas un tipo de documento.'),
}).strict()

export type CreditFileInput = z.infer<typeof CreditFileInputSchema>
export type CreditFileDecision = z.infer<typeof CreditFileDecisionSchema>

/** Eligibility describes the checklist, not whether a financial transaction is authorized. */
export function evaluateCreditFile(file: CreditFileDTO | null, policy: CreditFilePolicy): { eligible: boolean; missing: string[] } {
  const missing: string[] = []
  if (!file) missing.push('file')
  if (file?.status !== 'approved' || !file.lastDecision) missing.push('approval')
  if (policy.requireIdentity && !file?.identity.number.trim()) missing.push('identity')
  const verifiedReferences = file?.references.filter(reference => reference.verificationStatus === 'verified'
    && reference.verifiedAt && reference.verifiedBy).length ?? 0
  if (verifiedReferences < policy.minVerifiedReferences) missing.push('references')
  for (const type of policy.requiredDocuments) {
    if (!file?.documents.some(document => document.type === type && document.lifecycle === 'ready'
      && document.reviewStatus === 'verified' && document.reviewedAt && document.reviewedBy)) {
      missing.push(`document:${type}`)
    }
  }
  return { eligible: missing.length === 0, missing }
}
