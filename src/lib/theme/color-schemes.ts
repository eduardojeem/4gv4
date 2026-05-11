export const SYSTEM_COLOR_SCHEME_VALUES = [
  'blue',
  'corporate',
  'indigo',
  'teal',
  'green',
  'purple',
  'pink',
  'orange',
  'amber',
  'red',
  'cyan',
] as const

export type SystemColorScheme = (typeof SYSTEM_COLOR_SCHEME_VALUES)[number]
export type ThemeColorScheme = SystemColorScheme | 'default' | 'custom'

export interface SystemColorSchemeOption {
  value: SystemColorScheme
  label: string
  description: string
  badge?: string
  swatches: readonly [string, string, string]
}

export const DEFAULT_SYSTEM_COLOR_SCHEME: SystemColorScheme = 'blue'

export const SYSTEM_COLOR_SCHEME_OPTIONS: readonly SystemColorSchemeOption[] = [
  {
    value: 'blue',
    label: 'Azul',
    description: 'Equilibrado y familiar para uso diario.',
    badge: 'Base',
    swatches: ['#dbeafe', '#60a5fa', '#1d4ed8'],
  },
  {
    value: 'corporate',
    label: 'Corporativo',
    description: 'Sobrio y profesional para entornos formales.',
    badge: 'Pro',
    swatches: ['#dfe8ff', '#4f7cff', '#1e3a8a'],
  },
  {
    value: 'indigo',
    label: 'Indigo',
    description: 'Tecnologico y solido para paneles intensivos.',
    swatches: ['#e0e7ff', '#818cf8', '#4338ca'],
  },
  {
    value: 'teal',
    label: 'Teal',
    description: 'Limpio y moderno con un tono fresco.',
    swatches: ['#ccfbf1', '#2dd4bf', '#0f766e'],
  },
  {
    value: 'green',
    label: 'Verde',
    description: 'Confiable y claro para una interfaz amigable.',
    swatches: ['#dcfce7', '#4ade80', '#15803d'],
  },
  {
    value: 'purple',
    label: 'Violeta',
    description: 'Premium y expresivo sin perder legibilidad.',
    swatches: ['#ede9fe', '#a78bfa', '#7e22ce'],
  },
  {
    value: 'pink',
    label: 'Rosa',
    description: 'Energetico y distintivo para una UI mas viva.',
    swatches: ['#fce7f3', '#f472b6', '#be185d'],
  },
  {
    value: 'orange',
    label: 'Naranja',
    description: 'Cercano y comercial para entornos de venta.',
    swatches: ['#ffedd5', '#fb923c', '#c2410c'],
  },
  {
    value: 'amber',
    label: 'Ambar',
    description: 'Calido y visible, ideal para foco visual.',
    swatches: ['#fef3c7', '#fbbf24', '#b45309'],
  },
  {
    value: 'red',
    label: 'Rojo',
    description: 'Directo y potente para equipos que prefieren contraste.',
    swatches: ['#fee2e2', '#f87171', '#b91c1c'],
  },
  {
    value: 'cyan',
    label: 'Cian',
    description: 'Ligero y contemporaneo para una sensacion mas aerea.',
    swatches: ['#cffafe', '#22d3ee', '#0f766e'],
  },
] as const

export function isSystemColorScheme(value: string): value is SystemColorScheme {
  return SYSTEM_COLOR_SCHEME_VALUES.includes(value as SystemColorScheme)
}

export function getSystemColorSchemeOption(value?: string | null): SystemColorSchemeOption {
  return (
    SYSTEM_COLOR_SCHEME_OPTIONS.find((option) => option.value === value) ??
    SYSTEM_COLOR_SCHEME_OPTIONS.find((option) => option.value === DEFAULT_SYSTEM_COLOR_SCHEME)!
  )
}
