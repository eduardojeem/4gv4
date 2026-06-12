export function getProductSubmitState({
  isEditing,
  isSubmitting,
  isValid,
}: {
  isEditing: boolean
  isSubmitting: boolean
  isValid: boolean
}) {
  if (isSubmitting) {
    return {
      label: 'Guardando...',
      status: 'Guardando los cambios del producto.',
      ready: false,
    }
  }

  if (!isValid) {
    return {
      label: 'Revisar datos obligatorios',
      status: 'Faltan datos obligatorios. Al continuar, te llevaremos a la sección pendiente.',
      ready: false,
    }
  }

  return {
    label: isEditing ? 'Actualizar Producto' : 'Crear Producto',
    status: isEditing ? 'Todos los datos están listos para actualizar.' : 'Todos los datos están listos para crear.',
    ready: true,
  }
}
