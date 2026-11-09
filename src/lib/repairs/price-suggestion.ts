/**
 * Precio sugerido por historial: lo que el taller ya cobró por el mismo modelo
 * y una falla parecida. Ayuda a no tener que acordarse ni buscar, y a cobrar
 * siempre lo mismo por el mismo trabajo.
 */

export type PricedRepairHistory = {
  device_brand: string | null
  device_model: string | null
  problem_description: string | null
  final_cost: number | string | null
  delivered_at?: string | null
  updated_at?: string | null
}

export type PriceSuggestion = {
  /** Lo último que se cobró por ese trabajo. */
  lastPrice: number
  /** Precio típico (mediana) cuando hay varias reparaciones iguales. */
  typicalPrice: number
  count: number
  /** Cómo se describe la coincidencia: «pantalla» en «Samsung A05». */
  matchedIssue: string
  device: string
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'sin', 'por', 'para', 'no', 'un', 'una', 'se', 'que', 'al', 'lo', 'le'])

/** Palabras que dicen qué se arregló: «Cambio de pantalla rota» → pantalla, rota, cambio. */
export function issueKeywords(text: string | null | undefined): string[] {
  return [...new Set(
    (text ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9ñ]+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  )]
}

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase() && Boolean((a ?? '').trim())

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/**
 * Con el mismo modelo, la reparación cuya falla comparte más palabras con la
 * actual define el trabajo; si ninguna comparte, no se sugiere nada (un cambio
 * de batería no vale lo que un cambio de pantalla).
 */
export function suggestRepairPrice(
  current: { brand: string | null | undefined; model: string | null | undefined; issue: string | null | undefined },
  history: PricedRepairHistory[],
): PriceSuggestion | null {
  const keywords = issueKeywords(current.issue)
  if (!keywords.length) return null
  const scored = history
    .filter((repair) => sameText(repair.device_brand, current.brand) && sameText(repair.device_model, current.model) && Number(repair.final_cost) > 0)
    .map((repair) => {
      const words = issueKeywords(repair.problem_description)
      const shared = keywords.filter((word) => words.includes(word))
      return { repair, shared, score: shared.length }
    })
    .filter((item) => item.score > 0)
  if (!scored.length) return null

  const best = Math.max(...scored.map((item) => item.score))
  const matches = scored
    .filter((item) => item.score === best)
    .sort((a, b) => (b.repair.delivered_at ?? b.repair.updated_at ?? '').localeCompare(a.repair.delivered_at ?? a.repair.updated_at ?? ''))
  const prices = matches.map((item) => Number(item.repair.final_cost))
  return {
    lastPrice: prices[0],
    typicalPrice: median(prices),
    count: matches.length,
    matchedIssue: matches[0].shared.join(' '),
    device: [current.brand, current.model].filter(Boolean).join(' '),
  }
}

/** «La última vez cobraste ₲ 350.000 por pantalla en Samsung A05 (3 veces, típico ₲ 340.000).» */
export function describeSuggestion(suggestion: PriceSuggestion, format: (value: number) => string) {
  const base = `La última vez cobraste ${format(suggestion.lastPrice)} por «${suggestion.matchedIssue}» en ${suggestion.device}`
  return suggestion.count > 1 && suggestion.typicalPrice !== suggestion.lastPrice
    ? `${base} (${suggestion.count} veces, lo típico ${format(suggestion.typicalPrice)}).`
    : `${base}.`
}
