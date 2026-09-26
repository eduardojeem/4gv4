/**
 * Normalizacion de los puntos que van a los graficos del PDF.
 *
 * `ChartExporter` lo usan dos tableros que traen los datos con claves distintas:
 * la pagina de reportes arma `{ name, sales }` y `{ date, count }`, y el panel
 * de admin `{ label, value }`. El exportador leia solo las primeras, asi que un
 * dataset del admin llegaba con `label: undefined` y el renderer del donut se
 * caia al medir su largo —`Cannot read properties of undefined (reading
 * 'length')`—; los que no se caian salian dibujados en cero.
 */

export type ChartPointSource = Record<string, unknown> | null | undefined

/** Etiqueta del punto, mirando las claves de los dos tableros. */
export function chartPointLabel(row: ChartPointSource, fallback: string): string {
  const source = row as Record<string, unknown> | null | undefined
  const candidate = source?.name ?? source?.label ?? source?.date
  if (candidate === null || candidate === undefined) return fallback

  const text = String(candidate).trim()
  return text || fallback
}

/** Valor del punto. Siempre un numero finito: un `NaN` rompe el canvas entero. */
export function chartPointValue(row: ChartPointSource): number {
  const source = row as Record<string, unknown> | null | undefined
  const candidate = source?.sales ?? source?.value ?? source?.count ?? source?.total
  const parsed = Number(candidate ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
