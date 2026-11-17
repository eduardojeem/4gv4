import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('imprimir al registrar una reparación en la app', () => {
  it('al crearla abre el detalle marcándola como nueva', () => {
    expect(read('mobile/src/app/panel/repairs/new.tsx')).toContain("params: { nuevo: '1' }")
  })

  it('el detalle de una recién registrada ofrece el comprobante para el cliente', () => {
    const detail = read('mobile/src/app/panel/repairs/[id].tsx')
    expect(detail).toContain("useState(nuevo === '1')")
    expect(detail).toContain('Reparación registrada')
    // El mismo comprobante que en el detalle de siempre: imprimir, PDF y WhatsApp.
    expect(detail.match(/<DocumentActions path=\{'\/api\/repairs\/'\+encodeURIComponent\(repair\.id\)\+'\/receipt'\}/g)).toHaveLength(2)
  })
})
