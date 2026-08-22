export function invalidateBranchCatalogParts<T extends { productId?: string | null }>(parts: T[]) {
  return parts.filter((part) => !part.productId)
}
