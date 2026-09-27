import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateRepairHash, verifyRepairHash } from '@/lib/repair-qr-hash'
import { DEFAULT_RECEIPT_SETTINGS, printRepairReceipt, type RepairPrintPayload } from '@/lib/repair-receipt'

const RAIZ = process.cwd()
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

function archivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosDe(ruta)
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : []
  })
}

/**
 * El hash del comprobante lleva un secreto y el `crypto` de Node. Mientras
 * vivio junto a los helpers de URL, el cliente de /dashboard/repairs lo
 * importaba: el bundler metia crypto-browserify entero (el chunk de 660 KB) y,
 * sin el secreto en el navegador, el hash salia mal o la funcion lanzaba.
 */
describe('el hash de reparaciones se queda en el servidor', () => {
  it('los helpers de URL ya no traen el crypto de Node', () => {
    const fuente = leer('src/lib/repair-qr.ts')
    expect(fuente).not.toMatch(/from ['"](node:)?crypto['"]/)
    expect(fuente).not.toContain('REPAIR_QR_SECRET')
  })

  it('ningun archivo del cliente importa el hash', () => {
    const importadores = archivosDe(join(RAIZ, 'src'))
      .filter((ruta) => !ruta.includes(`${sep}test${sep}`))
      .filter((ruta) => readFileSync(ruta, 'utf8').includes("@/lib/repair-qr-hash'"))

    expect(importadores.length).toBeGreaterThan(0)
    for (const ruta of importadores) {
      const fuente = readFileSync(ruta, 'utf8')
      expect(fuente.slice(0, 400), relative(RAIZ, ruta)).not.toMatch(/['"]use client['"]/)
    }
  })

  it('el comprobante no calcula el hash por su cuenta', () => {
    const fuente = leer('src/lib/repair-receipt.ts')
    expect(fuente).not.toContain('generateRepairHash')
    expect(fuente).not.toContain('@/lib/repair-qr')
  })
})

describe('el hash', () => {
  it('es corto, estable y se puede verificar', () => {
    const fecha = new Date('2026-09-13T15:00:00.000Z')
    const hash = generateRepairHash('R-260913-0001', 'Ana Pérez', fecha)

    expect(hash).toMatch(/^[0-9a-f]{16}$/)
    expect(generateRepairHash('R-260913-0001', 'Ana Pérez', fecha)).toBe(hash)
    expect(verifyRepairHash('R-260913-0001', 'Ana Pérez', fecha, hash)).toBe(true)
    expect(verifyRepairHash('R-260913-0002', 'Ana Pérez', fecha, hash)).toBe(false)
  })
})

describe('el comprobante impreso', () => {
  const payload = (verificationHash?: string): RepairPrintPayload => ({
    ticketNumber: 'R-260913-0001',
    date: new Date('2026-09-13T15:00:00.000Z'),
    customer: { name: 'Ana Pérez', phone: '0981000000' },
    devices: [{ typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'Pantalla rota' }],
    verificationHash,
  })

  const imprimir = (p: RepairPrintPayload) => {
    let html = ''
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (h: string) => { html = h }, close: () => {} },
      closed: false,
      focus: () => {},
    } as unknown as Window)
    printRepairReceipt('customer', p, '80mm', { ...DEFAULT_RECEIPT_SETTINGS, showHash: true })
    return html
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('muestra el hash firmado por el servidor', () => {
    const html = imprimir(payload('a1b2c3d4e5f60718'))
    expect(html).toContain('Hash de verificación')
    expect(html).toContain('a1b2c3d4e5f60718')
  })

  /**
   * Sin hash firmado (por ejemplo, si fallo /api/repairs/sign) se inventaba uno
   * en el navegador. En produccion eso lanzaba y el comprobante no salia.
   */
  it('sin hash firmado no inventa uno, y en produccion no rompe la impresion', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('REPAIR_QR_SECRET', '')

    let html = ''
    expect(() => { html = imprimir(payload()) }).not.toThrow()
    expect(html).toContain('R-260913-0001')
    expect(html).not.toContain('Hash de verificación')
  })
})
