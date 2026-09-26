/**
 * Hace cuánto que está abierta la caja.
 *
 * El turno de caja se abre a la mañana y se cierra a la noche con el arqueo.
 * En la base, sin embargo, hay siete sesiones abiertas y una arrancó el 17 de
 * mayo: nadie las cierra. Decir «caja abierta» a secas tapa eso; decir desde
 * cuándo lo muestra, y decir cuántos días lleva lo vuelve imposible de ignorar.
 */

export type AperturaDescripta = {
  /** «desde las 08:15», «desde ayer», «desde el 17 de mayo». */
  texto: string
  /** Días completos desde que se abrió. 0 es hoy. */
  dias: number
  /** Se abrió otro día: el arqueo de ayer no se hizo. */
  deOtroDia: boolean
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Medianoche local, para contar días de calendario y no de 24 horas. */
function aMedianoche(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()
}

export function describeSessionOpening(
  openedAt: string | null | undefined,
  ahora: Date = new Date(),
): AperturaDescripta | null {
  if (!openedAt) return null
  const apertura = new Date(openedAt)
  if (Number.isNaN(apertura.getTime())) return null

  const dias = Math.max(0, Math.round((aMedianoche(ahora) - aMedianoche(apertura)) / MS_POR_DIA))

  if (dias === 0) {
    // 24 horas: «08:15», no «08:15 a. m.».
    const hora = apertura.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    return { texto: `desde las ${hora}`, dias, deOtroDia: false }
  }

  if (dias === 1) {
    return { texto: 'desde ayer', dias, deOtroDia: true }
  }

  const fecha = apertura.toLocaleDateString('es-PY', { day: 'numeric', month: 'long' })
  return { texto: `desde el ${fecha}`, dias, deOtroDia: true }
}
