/**
 * Cómo se distingue un equipo de otro mientras se carga la orden.
 *
 * La tarjeta mostraba marca y modelo sólo cuando estaban los dos completos, así
 * que hasta terminar de escribir los tres equipos decían «Dispositivo 1», «2» y
 * «3» y nada más. Y cuando el cliente trae dos iguales —pasa seguido con
 * teléfonos de la misma familia— ni marca y modelo alcanzan: lo que separa uno
 * del otro es el número de serie o la falla.
 *
 * Se arma con lo que haya, en orden de cuánto identifica:
 * marca y modelo primero, después la serie, y la falla al final.
 */

export type DeviceIdentityInput = {
  brand?: string | null
  model?: string | null
  serialNumber?: string | null
  issue?: string | null
}

const limpiar = (value: string | null | undefined) => String(value ?? '').trim()

/** El nombre del equipo: «Samsung A54», «Samsung», o vacío si todavía no hay nada. */
export function describeDeviceName(device: DeviceIdentityInput): string {
  return [limpiar(device.brand), limpiar(device.model)].filter(Boolean).join(' ')
}

/**
 * La línea que va debajo del título. Devuelve vacío cuando no hay nada que
 * decir: un renglón con un guion suelto no ayuda a nadie.
 */
export function describeDeviceSummary(device: DeviceIdentityInput, maxIssueLength = 40): string {
  const partes: string[] = []

  const nombre = describeDeviceName(device)
  if (nombre) partes.push(nombre)

  // La serie es lo unico que separa de verdad dos equipos del mismo modelo.
  const serie = limpiar(device.serialNumber)
  if (serie) partes.push(`Nº ${serie}`)

  // La falla entra siempre que quepa: es como los nombra quien atiende.
  const falla = limpiar(device.issue)
  if (falla) {
    partes.push(falla.length > maxIssueLength ? `${falla.slice(0, maxIssueLength).trimEnd()}…` : falla)
  }

  return partes.join(' · ')
}

/**
 * Un color por equipo, para poder barrer la lista con la vista. Se repite a
 * partir del sexto, que en una recepción de diez ya no confunde: para entonces
 * la persona se guía por el texto.
 */
export const DEVICE_ACCENTS = [
  { badge: 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900', edge: 'border-l-slate-400 dark:border-l-slate-500' },
  { badge: 'bg-cyan-600 dark:bg-cyan-500', edge: 'border-l-cyan-500' },
  { badge: 'bg-violet-600 dark:bg-violet-500', edge: 'border-l-violet-500' },
  { badge: 'bg-amber-600 dark:bg-amber-500', edge: 'border-l-amber-500' },
  { badge: 'bg-emerald-600 dark:bg-emerald-500', edge: 'border-l-emerald-500' },
] as const

export function deviceAccent(index: number) {
  return DEVICE_ACCENTS[index % DEVICE_ACCENTS.length]
}
