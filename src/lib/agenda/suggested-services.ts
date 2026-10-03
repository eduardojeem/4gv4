/**
 * Servicios típicos por rubro, para que una agenda nueva no arranque vacía.
 * Se cargan como productos con unidad «servicio» (lo que la agenda reserva) y
 * el dueño ajusta precio y duración antes de agregarlos.
 */
export interface SuggestedService {
  name: string
  durationMinutes: number
  /** Precio orientativo en guaraníes; en otra moneda el dueño lo completa. */
  pricePyg: number
}

const SUGGESTIONS: Record<string, SuggestedService[]> = {
  barbershop: [
    { name: 'Corte clásico', durationMinutes: 30, pricePyg: 50000 },
    { name: 'Corte + barba', durationMinutes: 60, pricePyg: 80000 },
    { name: 'Perfilado de barba', durationMinutes: 20, pricePyg: 30000 },
    { name: 'Corte infantil', durationMinutes: 30, pricePyg: 40000 },
    { name: 'Lavado y peinado', durationMinutes: 30, pricePyg: 35000 },
    { name: 'Color / tintura', durationMinutes: 90, pricePyg: 150000 },
    { name: 'Tratamiento capilar', durationMinutes: 60, pricePyg: 120000 },
  ],
}

export function suggestedServicesFor(vertical: string | null | undefined): SuggestedService[] {
  return (vertical && SUGGESTIONS[vertical]) || []
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Los sugeridos que todavía no están cargados (comparando nombres sin acentos ni mayúsculas). */
export function missingSuggestedServices(vertical: string | null | undefined, existingNames: string[]): SuggestedService[] {
  const existing = new Set(existingNames.map(normalize))
  return suggestedServicesFor(vertical).filter((service) => !existing.has(normalize(service.name)))
}

/** SKU legible y casi único para un servicio creado desde la agenda. */
export function serviceSku(name: string, random: () => number = Math.random): string {
  const slug = normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 30)
  const suffix = Math.floor(random() * 36 ** 4).toString(36).toUpperCase().padStart(4, '0')
  return `SRV-${slug || 'SERVICIO'}-${suffix}`
}
