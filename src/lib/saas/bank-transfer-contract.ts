import { z } from 'zod'

export const BANK_TRANSFER_RECEIPT_BUCKET = 'subscription-transfer-receipts'
export const BANK_TRANSFER_RECEIPT_MAX_BYTES = 3 * 1024 * 1024
export const BANK_TRANSFER_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
export const bankTransferStatusSchema = z.enum(['awaiting_receipt', 'pending_review', 'approved', 'rejected', 'cancelled'])
export type BankTransferStatus = z.infer<typeof bankTransferStatusSchema>
export const bankTransferSettingsSchema = z.object({
  enabled: z.boolean(), bankName: z.string().trim().max(160), accountHolder: z.string().trim().max(200),
  accountNumber: z.string().trim().max(120), accountAlias: z.string().trim().max(120),
  currency: z.literal('PYG'), instructions: z.string().trim().max(3000),
}).strict().refine(value => !value.enabled || Boolean(value.bankName && value.accountHolder && (value.accountNumber || value.accountAlias)), {message:'Completá el banco, titular y número o alias de cuenta antes de habilitar transferencias'})
export type BankTransferSettings = z.infer<typeof bankTransferSettingsSchema>
export const createBankTransferSchema = z.object({planCode:z.enum(['BASIC','PRO','ENTERPRISE'])}).strict()
export const submitBankTransferReceiptSchema = z.object({
  path:z.string().min(1).max(500), mimeType:z.enum(BANK_TRANSFER_RECEIPT_MIME_TYPES),
  size:z.number().int().positive().max(BANK_TRANSFER_RECEIPT_MAX_BYTES), operationReference:z.string().trim().max(160).optional(),
}).strict()
export type BankTransferReceiptInput = z.infer<typeof submitBankTransferReceiptSchema>
export const reviewBankTransferSchema = z.object({decision:z.enum(['approved','rejected']),reason:z.string().trim().max(2000).optional(),bankOperationReference:z.string().trim().max(160).optional()}).strict().refine(value=>value.decision!=='rejected'||Boolean(value.reason),{message:'Indicá el motivo del rechazo'}).refine(value=>value.decision!=='approved'||Boolean(value.bankOperationReference),{message:'Indicá la referencia bancaria verificada'})
export type BankTransferReviewInput = z.infer<typeof reviewBankTransferSchema>
export interface BankTransferRequest {
  id:string; reference:string; organization_id:string; plan_code:'BASIC'|'PRO'|'ENTERPRISE'; plan_name:string;
  amount:number; currency:'PYG'; period_months:1; bank_snapshot:BankTransferSettings; status:BankTransferStatus;
  receipt_path:string|null; receipt_mime_type:string|null; receipt_size:number|null; operation_reference:string|null;
  bank_operation_reference:string|null; rejection_reason:string|null; created_by:string; reviewed_by:string|null; payment_id:string|null;
  period_starts_at:string|null; period_ends_at:string|null; created_at:string; updated_at:string; submitted_at:string|null; reviewed_at:string|null; cancelled_at?:string|null;
}
export interface BankTransferSettingsRecord extends BankTransferSettings { updatedAt:string|null }

export interface EligibleBankTransferPlan { code: 'BASIC'|'PRO'|'ENTERPRISE'; name:string; price:number; currency:'PYG' }
