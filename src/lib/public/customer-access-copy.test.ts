import { describe, expect, it } from 'vitest'
import { customerAccessCopy } from './customer-access-copy'

describe('acceso de clientes según lo que ofrece la tienda', () => {
  it('una barbería habla de turnos, no de equipos, reparaciones ni cuotas', () => {
    const copy = customerAccessCopy({ repairs: false, credits: false, orders: false, services: true })
    expect(copy.headline).toBe('Tus turnos y pagos, en un solo lugar')
    expect(copy.items.map((item) => item.title)).toEqual(['Turnos', 'Pagos y recibos'])
    expect(copy.registerLead).toBe('Con tu cuenta seguís tus turnos en esta tienda. Es gratis y toma un minuto.')
    expect(copy.defaultNextPath).toBe('/perfil')
  })

  it('una tienda de cosméticos sin taller ni créditos habla de pedidos', () => {
    const copy = customerAccessCopy({ repairs: false, credits: false, orders: true, services: false })
    expect(copy.headline).toBe('Tus compras y pagos, en un solo lugar')
    expect(copy.items.map((item) => item.title)).toEqual(['Pagos y recibos', 'Pedidos de compra'])
    expect(JSON.stringify(copy)).not.toMatch(/reparaci|equipo|cuota/i)
  })

  it('un taller conserva reparaciones y su página de seguimiento', () => {
    const copy = customerAccessCopy({ repairs: true, credits: true, orders: true, services: false })
    expect(copy.items[0].title).toBe('Reparaciones')
    expect(copy.registerLead).toContain('tus reparaciones y tus pedidos')
    expect(copy.defaultNextPath).toBe('/mis-reparaciones')
  })
})
