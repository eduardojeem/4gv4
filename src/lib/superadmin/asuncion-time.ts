/**
 * Conversión entre el valor de un <input type="datetime-local"> y una fecha ISO,
 * siempre en hora de Paraguay. Así el aviso se programa a la misma hora que ven
 * las tiendas, aunque el navegador del superadmin tenga otra zona horaria.
 */
export const ASUNCION_TIME_ZONE = 'America/Asuncion'

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ASUNCION_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function zonedParts(time: number) {
  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(new Date(time))) parts[part.type] = part.value
  return parts
}

/** Milisegundos que la hora de Asunción está adelantada (negativo: atrasada) respecto de UTC en ese instante. */
function zoneOffset(time: number): number {
  const p = zonedParts(time)
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return asUtc - Math.floor(time / 1000) * 1000
}

/** ISO → "YYYY-MM-DDTHH:mm" en hora de Asunción (para precargar el input). */
export function isoToAsuncionInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const p = zonedParts(time)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** "YYYY-MM-DDTHH:mm" leído como hora de Asunción → ISO en UTC. Devuelve null si el valor no es válido. */
export function asuncionInputToIso(value: string | null | undefined): string | null {
  const match = INPUT_PATTERN.exec(value ?? '')
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const wallClock = Date.UTC(year, month - 1, day, hour, minute)
  if (Number.isNaN(wallClock)) return null
  // Dos pasadas por si el desfase cambia justo en esa fecha (horario de verano histórico).
  let time = wallClock - zoneOffset(wallClock)
  time = wallClock - zoneOffset(time)
  return new Date(time).toISOString()
}
