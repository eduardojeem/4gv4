import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const header = readFileSync(
  join(__dirname, '../components/public/informatica-electronica/InformaticaElectronicaHeader.tsx'),
  'utf8',
)

describe('encabezado de Informática y Electrónica', () => {
  it('siempre ofrece volver al marketplace, aunque la tienda no tenga dirección ni WhatsApp', () => {
    expect(header).toContain('<Link href="/marketplace"')
    expect(header).toContain('Volver al Marketplace')
    expect(header).not.toContain('{(storeAddress || phoneClean) && (')
  })
})
