// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc})}))
import { BankTransferServiceError, createBankTransferRequest, reviewBankTransferRequest } from './bank-transfers'
import { bankTransferSettingsSchema, submitBankTransferReceiptSchema } from './bank-transfer-contract'
beforeEach(()=>vi.clearAllMocks())
it('returns controlled conflict errors without raw database details',async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{message:'TRANSFER_DUPLICATE_OPERATION internal secret'}})
 try {await reviewBankTransferRequest('actor','request',{decision:'approved',bankOperationReference:'REF'}) ;throw new Error('expected rejection')}
 catch(error){expect(error).toBeInstanceOf(BankTransferServiceError);expect((error as BankTransferServiceError).status).toBe(409);expect((error as Error).message).not.toContain('secret')}
})
it('rejects invalid input before any RPC and fails unavailable on unknown DB errors',async()=>{
 expect(()=>createBankTransferRequest('org','actor','FREE')).toThrow()
 expect(mocks.rpc).not.toHaveBeenCalled()
 mocks.rpc.mockResolvedValue({data:null,error:{message:'database private details'}})
 await expect(createBankTransferRequest('org','actor','BASIC')).rejects.toMatchObject({status:503,code:'TRANSFER_UNAVAILABLE'})
})
it('requires real bank details when enabled and restricts receipt sizes/types',()=>{
 expect(bankTransferSettingsSchema.safeParse({enabled:true,bankName:'',accountHolder:'',accountNumber:'',accountAlias:'',currency:'PYG',instructions:''}).success).toBe(false)
 expect(submitBankTransferReceiptSchema.safeParse({path:'p',mimeType:'application/pdf',size:3145729}).success).toBe(false)
 expect(submitBankTransferReceiptSchema.safeParse({path:'p',mimeType:'image/svg+xml',size:10}).success).toBe(false)
})

