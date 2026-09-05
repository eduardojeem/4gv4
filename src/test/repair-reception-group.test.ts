import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCreateRepairInput } from '@/lib/repairs/create-repair-input'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/app/dashboard/repairs/page.tsx')
const CONTEXTO = leer('src/contexts/RepairsContext.tsx')
const MIGRACION = leer('supabase/migrations/20260905120000_repair_reception_group.sql')

function entradaValida(extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: 'abcdefgh-1234',
    customer_id: '3f1c9a52-8b7e-4c1d-9a0f-2e5d7b6c4a13',
    device_brand: 'Samsung',
    device_model: 'A54',
    device_type: 'smartphone',
    problem_description: 'No enciende',
    ...extra,
  }
}

/**
 * El formulario ya creaba una orden por equipo, pero después quedaban sueltas:
 * nada registraba que el cliente las había dejado en la misma visita.
 */
describe('la recepción agrupa los equipos que llegaron juntos', () => {
  it('la API acepta el id de recepción', () => {
    const uuid = '11111111-2222-4333-8444-555555555555'
    const result = parseCreateRepairInput(entradaValida({ reception_id: uuid }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reception_id).toBe(uuid)
  })

  it('sigue aceptando una orden sin recepción', () => {
    // Un equipo que vino solo no se agrupa, y son la mayoría.
    expect(parseCreateRepairInput(entradaValida()).success).toBe(true)
    expect(parseCreateRepairInput(entradaValida({ reception_id: null })).success).toBe(true)
  })

  it('rechaza un id que no es UUID', () => {
    expect(parseCreateRepairInput(entradaValida({ reception_id: 'juntos' })).success).toBe(false)
  })

  it('el contexto lo manda a la API', () => {
    expect(CONTEXTO).toContain('reception_id: repairData.receptionId || null')
  })

  it('todas las órdenes del mismo envío comparten el valor', () => {
    expect(PAGINA).toContain("const receptionId = data.devices.length > 1 ? crypto.randomUUID() : null")
    // Se arma una vez, fuera del map: uno por equipo no agruparía nada.
    const map = PAGINA.slice(PAGINA.indexOf('const promises = data.devices.map'))
    expect(map.slice(0, 600)).toContain('receptionId,')
  })

  it('un solo equipo no genera recepción', () => {
    // Agrupar de a uno solo ensucia la tabla y el índice.
    expect(PAGINA).toContain('data.devices.length > 1 ? crypto.randomUUID() : null')
  })

  it('el índice es parcial y por tienda', () => {
    expect(MIGRACION).toContain('on public.repairs (organization_id, reception_id)')
    expect(MIGRACION).toContain('where reception_id is not null')
  })

  it('no se confunde con el retrabajo de posventa', () => {
    // `parent_repair_id` ya existía y es otra cosa: la orden que vuelve por
    // garantía apunta a la original.
    const tipos = leer('src/types/repairs.ts')
    expect(tipos).toContain('No confundir con `parentRepairId`')
  })
})

/**
 * El adelanto se cobraba solo cuando había un equipo. Con varios se descartaba
 * sin decir nada: el cliente pagaba y no quedaba registrado en ningún lado.
 */
describe('el adelanto ya no se pierde en silencio', () => {
  it('avisa y no guarda en vez de descartarlo', () => {
    expect(PAGINA).toContain('data.devices.length > 1 && (data.depositAmount ?? 0) > 0')
    expect(PAGINA).toContain('El adelanto se cobra sobre una orden y acá hay varios equipos.')
  })

  it('dice qué hacer, no solo que no se puede', () => {
    const bloque = PAGINA.slice(PAGINA.indexOf('El adelanto se cobra sobre una orden'))
    expect(bloque.slice(0, 400)).toContain('cobralo después desde la reparación que corresponda')
  })

  it('corta antes de crear nada', () => {
    // Si se crearan las órdenes y después fallara el aviso, quedarían las
    // reparaciones sin el adelanto y sin forma de saberlo.
    const guard = PAGINA.indexOf('El adelanto se cobra sobre una orden')
    const creacion = PAGINA.indexOf('const promises = data.devices.map')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(creacion)
  })
})

describe('la recepción se ve en la orden', () => {
  const bloque = leer('src/components/dashboard/repairs/ReceptionSiblings.tsx')
  const dialogo = leer('src/components/dashboard/repairs/RepairDetailDialog.tsx')

  it('busca las hermanas por la recepción', () => {
    expect(bloque).toContain("eq('reception_id', receptionId)")
  })

  it('no se lista a sí misma', () => {
    expect(bloque).toContain('r.id !== currentRepairId')
  })

  it('no muestra nada cuando el equipo vino solo', () => {
    expect(bloque).toContain('if (!receptionId || cargando || hermanas.length === 0) return null')
  })

  it('está montado en el detalle de la orden', () => {
    expect(dialogo).toContain('<ReceptionSiblings')
    expect(dialogo).toContain('receptionId={repair.receptionId}')
  })
})
