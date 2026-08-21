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

  it('explains a rejected customer type instead of returning a generic error', () => {
    expect(getCustomerWriteErrorResponse({
      code: '23514',
      message: 'violates check constraint "customers_customer_type_check"',
    }, 'update')).toEqual({
      status: 422,
      body: {
        success: false,
        code: 'CUSTOMER_TYPE_INVALID',
        error: 'El tipo de cliente seleccionado no es válido.',
      },
    })
  })
})
