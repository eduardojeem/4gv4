import { describe, expect, it } from 'vitest'
import {
  CreditFileInputSchema, CreditFileDecisionSchema, CreditFilePolicySchema,
  evaluateCreditFile, type CreditFileDTO,
} from '@/lib/credits/credit-file-contract'

const id = '10000000-0000-4000-8000-000000000001'
const input = { version: 0, identity: { type: 'ci', number: '' }, occupation: '', company: '', position: '',
  declaredMonthlyIncome: null, informedCustomer: false, references: [] }
const file: CreditFileDTO = { version: 1, status: 'approved', identity: { type: 'ci', number: '1234567' },
  occupation: '', company: '', position: '', declaredMonthlyIncome: null, informedCustomerAt: null,
  references: [], documents: [], lastDecision: { actorId: id, at: '2026-10-11T12:00:00Z', reason: 'Revisión manual' } }

describe('credit file input boundaries', () => {
  it('normalizes an empty declared income to null, without treating it as zero', () => {
    expect(CreditFileInputSchema.parse({ ...input, declaredMonthlyIncome: '' }).declaredMonthlyIncome).toBeNull()
  })
  it.each([-1, Infinity, NaN, 1_000_000_000_001, '3000000'])('rejects invalid income %s', (income) => {
    expect(CreditFileInputSchema.safeParse({ ...input, declaredMonthlyIncome: income }).success).toBe(false)
  })
  it('allows exactly five references and rejects a sixth', () => {
    const references = Array.from({ length: 5 }, () => ({ name: 'Referencia', phone: '0981123456', relationship: 'Familiar', verificationStatus: 'pending', comment: '' }))
    expect(CreditFileInputSchema.safeParse({ ...input, references }).success).toBe(true)
    expect(CreditFileInputSchema.safeParse({ ...input, references: [...references, references[0]] }).success).toBe(false)
  })
  it.each([{ name: '', phone: '0981123456' }, { name: 'Referencia', phone: '' }])('rejects incomplete reference %j', (reference) => {
    expect(CreditFileInputSchema.safeParse({ ...input, references: [{ ...reference, relationship: 'Amigo', verificationStatus: 'pending', comment: '' }] }).success).toBe(false)
  })
  it.each([-1, 1.5])('rejects invalid expected version %s', (version) => {
    expect(CreditFileInputSchema.safeParse({ ...input, version }).success).toBe(false)
  })
  it('rejects forged approval, actor, timestamps and document metadata', () => {
    for (const extra of [{ status: 'approved' }, { actorId: id }, { documents: [] }, { informedCustomerAt: '2026-10-11T12:00:00Z' }]) {
      expect(CreditFileInputSchema.safeParse({ ...input, ...extra }).success).toBe(false)
    }
  })
  it('rejects duplicated reference ids and forged verification actor', () => {
    const reference = { id, name: 'Referencia', relationship: 'Familiar', phone: '0981123456', verificationStatus: 'verified', comment: '' }
    expect(CreditFileInputSchema.safeParse({ ...input, references: [reference, reference] }).success).toBe(false)
    expect(CreditFileInputSchema.safeParse({ ...input, references: [{ ...reference, verifiedBy: id }] }).success).toBe(false)
  })
})

describe('manual decisions and organization policy', () => {
  it('requires a reason and finite authorized limit for approval', () => {
    expect(CreditFileDecisionSchema.safeParse({ version: 1, status: 'approved', limit: 100000, reason: '   ' }).success).toBe(false)
    expect(CreditFileDecisionSchema.safeParse({ version: 1, status: 'approved', reason: 'Evaluado' }).success).toBe(false)
    expect(CreditFileDecisionSchema.parse({ version: 1, status: 'approved', limit: 0, reason: ' Sin cupo ' }).reason).toBe('Sin cupo')
  })
  it('does not accept an arbitrary status or approve during ordinary save', () => {
    expect(CreditFileDecisionSchema.safeParse({ version: 1, status: 'draft', reason: 'Guardar' }).success).toBe(false)
  })
  it('starts informational, without mandatory references or documents', () => {
    expect(CreditFilePolicySchema.parse({})).toEqual({ version: 0, mode: 'informational', requireIdentity: false, minVerifiedReferences: 0, requiredDocuments: [] })
  })
  it('rejects duplicate or unknown document requirements', () => {
    expect(CreditFilePolicySchema.safeParse({ requiredDocuments: ['identity', 'identity'] }).success).toBe(false)
    expect(CreditFilePolicySchema.safeParse({ requiredDocuments: ['passport_pdf'] }).success).toBe(false)
  })
})

describe('current checklist evaluation', () => {
  const policy = CreditFilePolicySchema.parse({ mode: 'required', requireIdentity: true, minVerifiedReferences: 1, requiredDocuments: ['identity'] })
  it('never interprets missing or pending file as approval', () => {
    expect(evaluateCreditFile(null, policy)).toEqual({ eligible: false, missing: ['file', 'approval', 'identity', 'references', 'document:identity'] })
    expect(evaluateCreditFile({ ...file, status: 'pending' }, CreditFilePolicySchema.parse({})).eligible).toBe(false)
  })
  it('does not count an uploaded but unreviewed or incomplete document', () => {
    const document = { id, type: 'identity' as const, filename: 'cedula.jpg', lifecycle: 'pending' as const, reviewStatus: 'verified' as const,
      reviewedAt: '2026-10-11T12:00:00Z', reviewedBy: id, comment: '' }
    expect(evaluateCreditFile({ ...file, documents: [document] }, policy).missing).toContain('document:identity')
    expect(evaluateCreditFile({ ...file, documents: [{ ...document, lifecycle: 'ready', reviewStatus: 'pending' }] }, policy).missing).toContain('document:identity')
    expect(evaluateCreditFile({ ...file, documents: [{ ...document, lifecycle: 'deleted' }] }, policy).missing).toContain('document:identity')
  })
  it('requires verification evidence, not just a status string', () => {
    const reference = { id, name: 'Referencia', relationship: 'Familiar', phone: '0981123456', verificationStatus: 'verified' as const, verifiedAt: null, verifiedBy: null, comment: '' }
    expect(evaluateCreditFile({ ...file, references: [reference] }, policy).missing).toContain('references')
  })
  it('rechecks the current requirements even after manual approval', () => {
    const complete: CreditFileDTO = { ...file,
      references: [{ id, name: 'Referencia', relationship: 'Familiar', phone: '0981123456', verificationStatus: 'verified', verifiedAt: '2026-10-11T12:00:00Z', verifiedBy: id, comment: '' }],
      documents: [{ id, type: 'identity', filename: 'cedula.jpg', lifecycle: 'ready', reviewStatus: 'verified', reviewedAt: '2026-10-11T12:00:00Z', reviewedBy: id, comment: '' }] }
    expect(evaluateCreditFile(complete, policy)).toEqual({ eligible: true, missing: [] })
    expect(evaluateCreditFile(complete, { ...policy, requiredDocuments: ['identity', 'address'] })).toEqual({ eligible: false, missing: ['document:address'] })
  })
})
