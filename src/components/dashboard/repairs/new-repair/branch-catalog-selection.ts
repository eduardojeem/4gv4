export function invalidateBranchCatalogParts<T extends { productId?: string | null; lineType?: string | null }>(parts: T[]) {
  return parts.filter((part) => !(part.lineType === 'charged_part' && part.productId))
}
