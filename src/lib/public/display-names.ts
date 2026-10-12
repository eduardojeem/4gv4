/**
 * Cómo se muestra el nombre de una categoría en el marketplace.
 *
 * Cada tienda escribe las suyas a su manera y en la misma franja convivían
 * «HOGAR», «accesorios» y «Audio y Video». Solo se normaliza lo que es claramente
 * de forma, no de contenido:
 * - todo en mayúsculas → mayúscula inicial («HOGAR» → «Hogar»), salvo siglas
 *   cortas de una palabra («CCTV», «LED»);
 * - empieza en minúscula → mayúscula inicial («audio» → «Audio»).
 * Lo demás («Pantallas LCD/OLED», «iPhone») queda como lo escribió la tienda.
 */
export function displayCategoryName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed

  const hasLower = /\p{Ll}/u.test(trimmed)
  const hasUpper = /\p{Lu}/u.test(trimmed)

  if (hasUpper && !hasLower) {
    const isAcronym = !trimmed.includes(' ') && trimmed.replace(/[^\p{L}]/gu, '').length <= 4
    if (isAcronym) return trimmed
    const lower = trimmed.toLocaleLowerCase('es')
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
  }

  if (/^\p{Ll}/u.test(trimmed) && !/^\p{Ll}\p{Lu}/u.test(trimmed)) {
    return trimmed.charAt(0).toLocaleUpperCase('es') + trimmed.slice(1)
  }

  return trimmed
}
