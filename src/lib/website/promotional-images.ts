const TEMPLATE_NAMES = [
  'hero-barberia-turnos', 'hero-barberia-combo', 'hero-barberia-insumos',
  'hero-barberia-barba', 'hero-barberia-spa', 'hero-linea-corporativa',
  'hero-moda-esenciales', 'hero-moda-urbana',
] as const

/** Compatibility for saved template URLs; uploaded or external photos are never rewritten. */
export const PROMOTIONAL_TEMPLATE_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  TEMPLATE_NAMES.map(name => [`/images/promotional-carousel/${name}.jpg`, `/images/promotional-carousel/${name}.webp`]),
)

export function resolvePromotionalTemplateImage(source: string): string {
  const path = source.trim().split(/[?#]/)[0]
  return PROMOTIONAL_TEMPLATE_ALIASES[path] ?? source
}

export function isOptimizedPromotionalTemplate(source: string): boolean {
  return Object.values(PROMOTIONAL_TEMPLATE_ALIASES).includes(source.split(/[?#]/)[0])
}