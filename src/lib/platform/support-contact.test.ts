import { describe, expect, it } from 'vitest'
import { normalizePlatformBranding } from './branding'
import {
  DEFAULT_SUPPORT_EMAIL,
  buildSupportContact,
  formatSupportWhatsapp,
  normalizeSupportEmail,
  normalizeSupportHours,
  normalizeSupportWhatsapp,
  resolveSupportEmail,
  supportWhatsappLink,
} from './support-contact'

describe('contacto de soporte', () => {
  it('normaliza el correo y descarta lo que no es un correo', () => {
    expect(normalizeSupportEmail('  Soporte@MiTiendaPy.com ')).toBe('soporte@mitiendapy.com')
    expect(normalizeSupportEmail('soporte')).toBe('')
    expect(normalizeSupportEmail('a@b')).toBe('')
    expect(normalizeSupportEmail('a b@c.com')).toBe('')
    expect(normalizeSupportEmail(42)).toBe('')
  })

  it('pide el WhatsApp en formato internacional', () => {
    expect(normalizeSupportWhatsapp('+595 981 123-456')).toBe('+595981123456')
    expect(normalizeSupportWhatsapp('00595 (981) 123456')).toBe('+595981123456')
    expect(normalizeSupportWhatsapp('0981123456')).toBe('')
    expect(normalizeSupportWhatsapp('+595abc')).toBe('')
    expect(normalizeSupportWhatsapp('+0981123456')).toBe('')
    expect(normalizeSupportWhatsapp('+5959811234567890')).toBe('')
  })

  it('arma el enlace wa.me y el número legible', () => {
    expect(supportWhatsappLink('+595981123456')).toBe('https://wa.me/595981123456')
    expect(supportWhatsappLink('+595981123456', 'Hola, ayuda')).toBe('https://wa.me/595981123456?text=Hola%2C%20ayuda')
    expect(supportWhatsappLink('')).toBeNull()
    expect(formatSupportWhatsapp('+595981123456')).toBe('+595 981123456')
    expect(formatSupportWhatsapp('+5491112345678')).toBe('+5491112345678')
  })

  it('el horario es un texto corto de una línea', () => {
    expect(normalizeSupportHours('  Lun a vie\n 8 a 18 h ')).toBe('Lun a vie 8 a 18 h')
    expect(normalizeSupportHours('x'.repeat(200))).toHaveLength(80)
  })

  it('el correo del superadmin manda sobre las variables de entorno', () => {
    const env = { SUPPORT_EMAIL: 'env@mitiendapy.com', EMAIL_REPLY_TO: 'reply@mitiendapy.com' }
    expect(resolveSupportEmail('marca@mitiendapy.com', env)).toBe('marca@mitiendapy.com')
    expect(resolveSupportEmail('', env)).toBe('env@mitiendapy.com')
    expect(resolveSupportEmail('', { EMAIL_REPLY_TO: 'reply@mitiendapy.com' })).toBe('reply@mitiendapy.com')
    expect(resolveSupportEmail('', {})).toBe(DEFAULT_SUPPORT_EMAIL)
  })

  it('buildSupportContact junta todo lo que se muestra', () => {
    expect(buildSupportContact({ supportWhatsapp: '+595 981 123456', supportHours: 'Lun a vie' }, {})).toEqual({
      email: DEFAULT_SUPPORT_EMAIL,
      whatsapp: '+595981123456',
      whatsappUrl: 'https://wa.me/595981123456',
      hours: 'Lun a vie',
    })
  })

  it('la marca guarda los campos de soporte normalizados y vacíos si no sirven', () => {
    const branding = normalizePlatformBranding({
      supportEmail: 'SOPORTE@mitiendapy.com',
      supportWhatsapp: '+595 981 123456',
      supportHours: ' Lun a vie ',
    })
    expect(branding).toMatchObject({ supportEmail: 'soporte@mitiendapy.com', supportWhatsapp: '+595981123456', supportHours: 'Lun a vie' })
    expect(normalizePlatformBranding({ supportEmail: 'nada', supportWhatsapp: '0981' })).toMatchObject({ supportEmail: '', supportWhatsapp: '', supportHours: '' })
  })
})
