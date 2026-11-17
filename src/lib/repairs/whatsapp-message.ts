/** Nunca anteponer 595 a un número que ya tiene otro prefijo internacional. */
export function repairWhatsAppPhone(
  raw: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const value = raw?.trim() ?? ''
  if (!value || !/^\+?[\d\s().-]+$/.test(value)) return null
  let digits = value.replace(/\D/g, '')
  const international = value.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!international) {
    if (digits.startsWith('595') && digits.length >= 11) {
      if (digits.startsWith('5950')) digits = '595' + digits.slice(4)
    } else if (digits.length >= 11 && !digits.startsWith('0')) {
      /* Número ya internacional. */
    } else if (country === 'PY') {
      digits = digits.replace(/^0/, '')
      if (!/^[2-9]\d{7,8}$/.test(digits)) return null
      digits = '595' + digits
    } else return null
  }
  if (digits.startsWith('5950')) digits = '595' + digits.slice(4)
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null
}
export function repairStatusMessage(input: {
  customer: string
  business: string
  device: string
  ticket: string
  status: string
  trackingUrl: string
}) {
  const labels: Record<string, string> = {
    recibido: 'Recibida',
    diagnostico: 'En diagnóstico',
    reparacion: 'En reparación',
    pausado: 'En pausa',
    listo: 'Lista para retirar',
    entregado: 'Entregada',
    cancelado: 'Cancelada',
  }
  return [
    `Hola ${input.customer}. Te escribimos de *${input.business}*.`,
    '',
    `Orden: *${input.ticket}*`,
    `Equipo: ${input.device}`,
    `Estado actual: *${labels[input.status] ?? 'Estado por confirmar'}*`,
    input.status === 'listo' ? 'Podés responder este mensaje para coordinar el retiro.' : '',
    '',
    'Consultá el seguimiento:',
    input.trackingUrl,
    '',
    'Si tenés alguna consulta, respondé este mensaje.',
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
}
