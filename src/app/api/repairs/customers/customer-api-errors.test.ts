import { describe, expect, it } from 'vitest'
import { getCustomerWriteErrorResponse } from './customer-api-errors'

describe('getCustomerWriteErrorResponse', () => {
  it('turns an RLS rejection into an actionable forbidden response', () => {
    expect(getCustomerWriteErrorResponse({ code: '42501', message: 'new row violates row-level security policy' }))
      .toEqual({
        status: 403,
        body: {
          success: false,
          code: 'CUSTOMER_PERMISSION_DENIED',
          error: 'No tenés permiso para crear clientes en esta organización.',
        },
      })
  })
})
