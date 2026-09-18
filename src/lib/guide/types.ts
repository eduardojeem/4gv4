import { normalizeText } from '@/lib/text/normalize'
import type { BusinessVertical, OrganizationModule } from '@/lib/organization/business-profile'

/**
 * El contenido de la guía del sistema, en un solo lugar.
 *
 * La ayuda estaba repartida en quince modales, cada uno con su propio texto:
 * así fue como la guía terminó explicando un rol «Solo lectura» que no existe y
 * mandando a pedirle a soporte los permisos que hoy se asignan con un casillero.
 */

/** Un caso concreto, para quien aprende mirando un ejemplo antes que leyendo. */
export type GuideExample = {
  /** Lo que la persona quiere lograr, en sus palabras. */
  goal: string
  /** Qué hace, paso por paso. */
  setup: string[]
  /** Con qué se queda cuando termina. */
  result: string
  /** Rubro al que aplica el ejemplo; sin esto, sirve para cualquiera. */
  vertical?: BusinessVertical
}

export type GuideStep = {
  title: string
  description: string
}

export type GuideFaq = {
  question: string
  answer: string
}

/** Los grupos son los mismos del menú, para que la guía se lea en ese orden. */
export type GuideGroupId = 'sistema' | 'analytics' | 'operations' | 'administration'

export type GuideSection = {
  id: string
  /** `key` del menú del admin cuando la sección es una pantalla del panel. */
  navKey?: string
  title: string
  /** De qué se trata, en una frase. */
  summary: string
  /** A dónde ir para usarla. */
  href?: string
  group: GuideGroupId
  /** Palabras con las que alguien buscaría esto. */
  keywords: string[]
  steps: GuideStep[]
  examples?: GuideExample[]
  tips?: string[]
  faq?: GuideFaq[]
  /** Permisos con los que alcanza para usar la sección. */
  permissions?: string[]
  /** Módulo del plan que tiene que estar activo. */
  module?: OrganizationModule
}

export const GUIDE_GROUPS: { id: GuideGroupId; label: string; description: string }[] = [
  { id: 'sistema', label: 'Cómo funciona el sistema', description: 'Los conceptos que hacen falta antes de tocar cualquier pantalla' },
  { id: 'analytics', label: 'Análisis', description: 'Lo que pasó en el negocio, en números' },
  { id: 'operations', label: 'Operaciones', description: 'El día a día: caja, catálogo y reportes' },
  { id: 'administration', label: 'Administración', description: 'Equipo, tienda, plan y configuración' },
]

/**
 * Deja solo lo que la persona puede usar: sin esto la guía enseña funciones que
 * el plan no trae y manda a pantallas que el menú ni muestra.
 *
 * Sigue la misma regla que el menú: un admin ve todo lo que el plan incluye.
 * `hasPermission` devuelve false para los permisos que la organización no le
 * listó explícitamente, y sin esta salvedad la guía escondía secciones que el
 * menú del mismo usuario sí muestra.
 */
export function filterGuideSections(
  sections: readonly GuideSection[],
  options: {
    hasPermission?: (permission: string) => boolean
    modules?: readonly string[]
    isAdmin?: boolean
  },
): GuideSection[] {
  return sections.filter((section) => {
    if (section.module && options.modules && !options.modules.includes(section.module)) return false
    if (options.isAdmin) return true
    if (section.permissions?.length && options.hasPermission) {
      return section.permissions.some((permission) => options.hasPermission!(permission))
    }
    return true
  })
}

/** Busca sin importar tildes ni mayúsculas, como se escribe apurado. */
export function searchGuideSections(sections: readonly GuideSection[], query: string): GuideSection[] {
  const needle = normalizeText(query)
  if (!needle) return [...sections]

  return sections.filter((section) => {
    const haystack = [
      section.title,
      section.summary,
      ...section.keywords,
      ...section.steps.flatMap((step) => [step.title, step.description]),
      ...(section.examples ?? []).flatMap((example) => [example.goal, example.result, ...example.setup]),
      ...(section.faq ?? []).flatMap((entry) => [entry.question, entry.answer]),
      ...(section.tips ?? []),
    ].join(' ')
    return normalizeText(haystack).includes(needle)
  })
}

/** Los ejemplos que sirven para el rubro de la organización. */
export function examplesForVertical(
  section: GuideSection,
  vertical: BusinessVertical | null | undefined,
): GuideExample[] {
  const examples = section.examples ?? []
  const specific = examples.filter((example) => example.vertical && example.vertical === vertical)
  const general = examples.filter((example) => !example.vertical)
  return specific.length > 0 ? [...specific, ...general] : general.length > 0 ? general : examples
}
