import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { whatsappUrl } from '../../mobile/src/lib/agenda-model'

const screen = readFileSync(join(__dirname, '../../mobile/src/app/panel/repairs/index.tsx'), 'utf8')

/** Lista de reparaciones de la app: indicadores del taller y contacto rápido con el cliente. */
describe('lista de reparaciones en la app', () => {
  it('WhatsApp usa el número con 595, no el número local como viene cargado', () => {
    expect(screen).toContain('whatsappUrl(phone, repairWhatsAppMessage(repair, orgName))')
    expect(screen).not.toContain('https://wa.me/${cleanPhone}')
    expect(whatsappUrl('0981 123 456', 'hola')).toBe('https://wa.me/595981123456?text=hola')
  })

  it('si no hay app para llamar o WhatsApp, avisa en lugar de dejar una promesa rechazada', () => {
    expect(screen).toMatch(/Linking\.openURL\(url\)\.catch\(/)
    expect(screen).not.toMatch(/onPress=\{\(\) => Linking\.openURL/)
  })

  it('no dice "pagado" si la orden todavía no tiene presupuesto', () => {
    expect(screen).toContain("const payment = !quoted ? '' : balance > 0")
  })

  it('los indicadores salen de la lista "En curso" y no cambian al filtrar', () => {
    expect(screen).toContain("if (filter === 'active' && !search) setSummary(summarizeRepairs(")
    expect(screen).toContain('summary?.partial ? `${value}+`')
    // Cada indicador que filtra lleva al mismo estado que cuenta.
    expect(screen).toContain("label: 'En reparación', value: count(summary.inRepair)")
    expect(screen).toContain("if (repair.status === 'reparacion') summary.inRepair += 1;")
  })
})
