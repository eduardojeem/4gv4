type DatabaseError = {
  code?: string
  message?: string
}

export function getCustomerWriteErrorResponse(error: DatabaseError, operation: 'create' | 'update' = 'create') {
  if (error.code === '23514' && error.message?.includes('customers_customer_type_check')) {
    return {
      status: 422,
      body: {
        success: false,
        code: 'CUSTOMER_TYPE_INVALID',
        error: 'El tipo de cliente seleccionado no es válido.',
      },
    }
  }

  if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
    return {
      status: 403,
      body: {
        success: false,
        code: 'CUSTOMER_PERMISSION_DENIED',
        error: `No tenés permiso para ${operation === 'create' ? 'crear' : 'actualizar'} clientes en esta organización.`,
      },
    }
  }

  return {
    status: 500,
    body: { success: false, error: `No se pudo ${operation === 'create' ? 'crear' : 'actualizar'} el cliente.` },
  }
}
