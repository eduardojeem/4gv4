export function normalizeDeliveryLocation(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function matchDeliveryZone<T extends { name: string }>(
  zones: T[],
  city: string,
  neighborhood: string
): T | null {
  const location = normalizeDeliveryLocation([city, neighborhood].filter(Boolean).join(' '))
  const normalizedCity = normalizeDeliveryLocation(city)
  const normalizedNeighborhood = normalizeDeliveryLocation(neighborhood)
  if (!location || !normalizedCity || !normalizedNeighborhood) return null

  return zones.find((zone) => {
    const name = normalizeDeliveryLocation(zone.name)
    return name === location || (!/[,/\-]/.test(zone.name) && name === normalizedNeighborhood)
  }) ?? null
}

export function deliveryZoneMatchesLocation(
  zone: { name: string },
  city: string,
  neighborhood: string
) {
  return matchDeliveryZone([zone], city, neighborhood) !== null
}
