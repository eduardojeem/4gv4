export function resolveOfferPrice(basePrice: number, offerPrice: number | null | undefined, variantPrice: number) {
  if (variantPrice <= 0) return 0
  if (offerPrice == null || basePrice <= 0 || offerPrice >= basePrice) return variantPrice
  const discountRatio = offerPrice / basePrice
  const calculated = Math.round(variantPrice * discountRatio)
  return calculated > 0 && calculated < variantPrice ? calculated : variantPrice
}
