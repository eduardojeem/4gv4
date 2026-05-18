type ServiceLikeProduct = {
  name?: string | null
  sku?: string | null
  unit_measure?: string | null
  category?: {
    name?: string | null
  } | null
}

export function isServiceLikeProduct(product: ServiceLikeProduct): boolean {
  const name = String(product.name || '').toLowerCase().trim()
  const sku = String(product.sku || '').toUpperCase().trim()
  const unitMeasure = String(product.unit_measure || '').toLowerCase().trim()
  const categoryName = String(product.category?.name || '').toLowerCase().trim()

  return (
    unitMeasure === 'servicio' ||
    /^(SRV|SERV|SER)[-_]/.test(sku) ||
    categoryName.includes('servicio') ||
    categoryName.includes('mano de obra') ||
    name.startsWith('reparacion') ||
    name.startsWith('reparación') ||
    name.startsWith('servicio') ||
    name.startsWith('cambio') ||
    name.startsWith('limpieza') ||
    name.startsWith('baño') ||
    name.startsWith('bano') ||
    name.startsWith('software') ||
    name.startsWith('backup') ||
    name.startsWith('instalacion') ||
    name.startsWith('instalación') ||
    name.startsWith('diagnostico') ||
    name.startsWith('diagnóstico') ||
    name.includes('mano de obra')
  )
}
