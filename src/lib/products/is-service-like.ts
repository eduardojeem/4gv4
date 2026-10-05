type ServiceLikeProduct = {
  name?: string | null
  sku?: string | null
  unit_measure?: string | null
  category?: {
    name?: string | null
  } | null
}

export function isServiceLikeProduct(product: ServiceLikeProduct): boolean {
  const sku = String(product.sku || '').toUpperCase().trim()
  const unitMeasure = String(product.unit_measure || '').toLowerCase().trim()
  const categoryName = String(product.category?.name || '').toLowerCase().trim()

  return (
    unitMeasure === 'servicio' ||
    /^(SRV|SERV|SER)[-_]/.test(sku) ||
    categoryName.includes('servicio') ||
    categoryName.includes('mano de obra')
  )
}
