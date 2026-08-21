type DatabaseError = {
  code?: string
  message?: string
}

export function getCustomerWriteErrorResponse(error: DatabaseError) {
  if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
    return {
      status: 403,
      body: {
        success: false,
        code: 'CUSTOMER_PERMISSION_DENIED',
        error: 'No tenés permiso para crear clientes en esta organización.',
      },
    }
  }

  return {
    status: 500,
    body: { success: false, error: 'No se pudo crear el cliente.' },
  }
}
