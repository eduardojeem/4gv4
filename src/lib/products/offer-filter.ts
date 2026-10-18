/** Same operational offer rule used by the mobile product cards. */
export function hasActiveCatalogOffer(product: Record<string, unknown>): boolean {
 const offer = Number(product.offer_price)
 return product.has_offer === true && Number.isFinite(offer) && offer > 0 && offer < Number(product.sale_price)
}
