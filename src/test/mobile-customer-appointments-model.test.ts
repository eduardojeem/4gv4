import { expect, it } from 'vitest'
import {
  appointmentManagementPath,
  appointmentStatusLabel,
  formatAppointmentWhen,
  formatAppointmentPrice,
} from '../../mobile/src/lib/customer-appointments-model'
it('solo abre enlaces de gestión de turnos propios en el sitio del sistema', () => {
  expect(appointmentManagementPath('/turno/00000000-0000-4000-8000-000000000001')).toBe(
    '/turno/00000000-0000-4000-8000-000000000001',
  )
  for (const value of ['https://evil.test', '//evil.test', '/turno/../admin', '/turno/foo', null])
    expect(appointmentManagementPath(value)).toBeNull()
})
it('muestra fecha y hora en la zona de la tienda y no en la del teléfono', () => {
  const value = formatAppointmentWhen('2026-11-15T15:00:00Z', 'America/Asuncion')
  expect(value).toContain('12:00')
  expect(formatAppointmentWhen('bad', 'Invalid')).toBe('Fecha no disponible')
})
it('distingue precio oculto de un servicio realmente sin cargo', () => {
  expect(formatAppointmentPrice(null, 'PYG')).toBe('Consultá el precio con la tienda')
  expect(formatAppointmentPrice(0, 'PYG')).toBe('Sin cargo')
  expect(formatAppointmentPrice(45000, 'PYG')).toContain('45.000')
})
it('traduce estados para el cliente', () => {
  expect(appointmentStatusLabel('pending')).toBe('Por confirmar')
  expect(appointmentStatusLabel('no_show')).toBe('No asististe')
})
