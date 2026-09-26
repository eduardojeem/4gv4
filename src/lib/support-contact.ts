export function getMarketplaceSupportPhone(value: string | undefined): string | null {
  const phone = value?.trim()
  return phone ? phone : null
}
