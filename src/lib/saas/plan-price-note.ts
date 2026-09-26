/**
 * Coherencia entre el precio de un plan y su nota de precio.
 *
 * `price_note` no es una frase de marketing: es el sufijo del periodo que se
 * imprime junto al precio ("₲ 45.000 /por mes"). Cambiar el precio de un plan no
 * la revisa, y el formulario del panel la precarga con lo que ya habia, asi que
 * sobrevive a cualquier edicion sin que nadie la mire.
 *
 * Fue exactamente lo que paso con "Lite": una migracion vieja le puso
 * "Siempre gratis" cuando el tier `free` era realmente gratis, despues se
 * repricio a 45.000 y la nota siguió ahi, publicada en la pagina de planes y en
 * el registro.
 *
 * Esto avisa, no bloquea. "Primer mes gratis" es una nota legitima en un plan
 * pago, asi que solo se marcan las frases que afirman gratuidad permanente.
 */

export type PlanPriceNoteCheck =
  | { ok: true }
  | { ok: false; mensaje: string; sugerencia: string }

/** Notas que afirman que el plan no se cobra. Coincidencia exacta a proposito. */
const NOTAS_GRATUITAS = new Set([
  'siempre gratis',
  'siempre gratuito',
  'gratis',
  'gratuito',
  'free',
  'sin costo',
  'sin cargo',
])

/** Notas de periodo: describen cada cuanto se cobra. */
const NOTAS_DE_PERIODO = new Set([
  'por mes',
  'mensual',
  '/mes',
  'mes',
  'por año',
  'por ano',
  'anual',
  '/año',
  'año',
])

const normalizar = (nota: string) => nota.trim().toLowerCase().replace(/\s+/g, ' ')

export const NOTA_DE_PERIODO_POR_DEFECTO = 'por mes'
export const NOTA_GRATUITA_POR_DEFECTO = 'Siempre gratis'

export function checkPlanPriceNote(price: number, note: string): PlanPriceNoteCheck {
  const nota = normalizar(note)
  if (!nota) return { ok: true }

  const precio = Number(price) || 0

  if (precio > 0 && NOTAS_GRATUITAS.has(nota)) {
    return {
      ok: false,
      mensaje: `El plan cuesta más de 0 pero la nota dice «${note.trim()}». Así se publica en la página de planes y en el registro.`,
      sugerencia: NOTA_DE_PERIODO_POR_DEFECTO,
    }
  }

  if (precio === 0 && NOTAS_DE_PERIODO.has(nota)) {
    return {
      ok: false,
      mensaje: `El plan es gratuito pero la nota dice «${note.trim()}», como si se cobrara por período.`,
      sugerencia: NOTA_GRATUITA_POR_DEFECTO,
    }
  }

  return { ok: true }
}
