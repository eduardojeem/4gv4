export interface ProductSaveFeedback {
  title: string
  description: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

function getValidationDescription(message: string) {
  const details = message.split(':').slice(1).join(':').trim()
  return details.replace(/^[a-z_][a-z0-9_.]*:\s*/i, '') || 'Corrige los campos marcados e intenta nuevamente.'
}

export function getProductSaveFeedback(
  error: unknown,
  action: 'create' | 'update',
): ProductSaveFeedback {
  const message = getErrorMessage(error)
  const normalized = message.toLowerCase()
  const actionLabel = action === 'create' ? 'crear' : 'actualizar'

  if (
    normalized.includes('sku already exists') ||
    normalized.includes('producto con este sku') ||
    normalized.includes('duplicate key') ||
    normalized.includes('23505')
  ) {
    return {
      title: 'El SKU ya está en uso',
      description: `Cambia el SKU e intenta ${actionLabel} el producto nuevamente.`,
    }
  }

  if (normalized.includes('validation failed') || normalized.includes('validación')) {
    return {
      title: 'Revisa los datos del producto',
      description: getValidationDescription(message),
    }
  }

  if (normalized.includes('plan') && normalized.includes('productos')) {
    return {
      title: 'Alcanzaste el límite de productos',
      description: message,
    }
  }

  if (normalized.includes('module') && normalized.includes('plan')) {
    return {
      title: 'Inventario no disponible en tu plan',
      description: 'Activa el módulo de inventario o cambia de plan para crear productos.',
    }
  }

  if (
    normalized.includes('forbidden') ||
    normalized.includes('insufficient permissions') ||
    normalized.includes('sin permiso')
  ) {
    return {
      title: `No tienes permiso para ${actionLabel} productos`,
      description: `Solicita a un administrador acceso para ${actionLabel} productos en esta organización.`,
    }
  }

  if (normalized.includes('unauthorized') || normalized.includes('authentication')) {
    return {
      title: 'Tu sesión necesita renovarse',
      description: 'Vuelve a iniciar sesión y conserva estos datos antes de intentar nuevamente.',
    }
  }

  if (normalized.includes('sincronizar el stock inicial')) {
    return {
      title: 'No se pudo registrar el stock inicial',
      description: 'El producto no fue creado. Revisa la sucursal seleccionada e intenta nuevamente.',
    }
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed')
  ) {
    return {
      title: 'No se pudo conectar con el servidor',
      description: 'Revisa tu conexión. Tus datos siguen en el formulario para que puedas intentar nuevamente.',
    }
  }

  return {
    title: `No se pudo ${actionLabel} el producto`,
    description: 'Ocurrió un problema inesperado. Tus datos siguen en el formulario para que puedas intentar nuevamente.',
  }
}
