import { describe, expect, it } from 'vitest'
import { repairWhatsAppPhone, repairStatusMessage } from '@/lib/repairs/whatsapp-message'
describe('aviso móvil de reparación', () => {
  it('normaliza Paraguay sin alterar números internacionales', () => {
    expect(repairWhatsAppPhone('0981 234567', 'PY')).toBe('595981234567')
    expect(repairWhatsAppPhone('+54 9 11 12345678', 'PY')).toBe('5491112345678')
    expect(repairWhatsAppPhone('00595 981234567', 'PY')).toBe('595981234567')
    expect(repairWhatsAppPhone('5950981234567', 'PY')).toBe('595981234567')
  })
  it('rechaza teléfonos cortos, texto y locales sin país confirmado', () => {
    for (const value of ['123', 'cliente@example.com', '0981<script>'])
      expect(repairWhatsAppPhone(value, 'PY')).toBeNull()
    expect(repairWhatsAppPhone('0981234567', 'AR')).toBeNull()
  })
  it('incluye comercio, equipo, estado y seguimiento sin dar por enviado el mensaje', () => {
    const text = repairStatusMessage({
      customer: 'Ana',
      business: 'Taller Uno',
      device: 'Samsung A54',
      ticket: 'R-2026-42',
      status: 'pausado',
      trackingUrl: 'https://fixture.test/taller/mis-reparaciones/R-2026-42?verify=abc',
    })
    expect(text).toContain('\n')
    expect(text).toContain('Taller Uno')
    expect(text).toContain('Samsung A54')
    expect(text).toContain('En pausa')
    expect(text).toContain('https://fixture.test/')
    expect(text).not.toContain('lista para retirar')
  })
  it('solo avisa que se puede coordinar retiro cuando está lista', () => {
    const base = {
      customer: 'Ana',
      business: 'Taller',
      device: 'Equipo',
      ticket: 'R-2026-1',
      trackingUrl: 'https://fixture.test',
    }
    expect(repairStatusMessage({ ...base, status: 'listo' })).toContain('coordinar el retiro')
    expect(repairStatusMessage({ ...base, status: 'entregado' })).not.toContain(
      'coordinar el retiro',
    )
  })
})
