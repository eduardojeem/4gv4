/**
 * Auditoría: ¿qué productos pueden tener etiqueta hoy?
 *
 * Usa el mismo resolvedor que la impresión (`resolveLabelCode`), así que lo que
 * dice acá es exactamente lo que va a pasar al generar las etiquetas.
 *
 *   npx tsx scripts/audit-barcodes.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { detectBarcodeFormat, isValidEan13, resolveLabelCode } from '../src/lib/labels/barcode-format'

function loadEnv(): Record<string, string> {
  const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  const env: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    env[line.slice(0, line.indexOf('=')).trim()] = line.slice(line.indexOf('=') + 1).trim()
  }
  return env
}

type ProductRow = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  is_active: boolean | null
  has_variants: boolean | null
  organization_id: string
}

type VariantRow = {
  id: string
  product_id: string
  variant_name: string | null
  sku: string | null
  barcode: string | null
  is_active: boolean | null
  organization_id: string
}

async function main() {
  const env = loadEnv()
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const [orgs, products, variants] = await Promise.all([
    db.from('organizations').select('id, name'),
    db.from('products').select('id, name, sku, barcode, is_active, has_variants, organization_id'),
    db.from('product_variants').select('id, product_id, variant_name, sku, barcode, is_active, organization_id'),
  ])

  if (orgs.error || products.error || variants.error) {
    console.error('No se pudo leer:', orgs.error?.message, products.error?.message, variants.error?.message)
    process.exit(1)
  }

  const rows = (products.data ?? []) as ProductRow[]
  const variantRows = (variants.data ?? []) as VariantRow[]

  const resumen = (orgs.data ?? []).map((org) => {
    const own = rows.filter((row) => row.organization_id === org.id && row.is_active !== false)
    const conBarcode = own.filter((row) => (row.barcode ?? '').trim()).length
    const soloSku = own.filter((row) => !(row.barcode ?? '').trim() && (row.sku ?? '').trim()).length
    const sinNada = own.filter((row) => !resolveLabelCode(row))

    const formatos: Record<string, number> = {}
    const ean13Invalido: string[] = []
    const noImprimible: string[] = []
    const largos: string[] = []

    for (const row of own) {
      const code = resolveLabelCode(row)
      if (!code) continue
      formatos[code.format] = (formatos[code.format] ?? 0) + 1
      if (code.value.length > 20) largos.push(`${row.name} (${code.value.length} caracteres)`)

      const raw = (row.barcode ?? '').trim()
      if (!raw) continue
      if (!detectBarcodeFormat(raw)) noImprimible.push(`${row.name}: ${JSON.stringify(raw)}`)
      else if (raw.length === 13 && !isValidEan13(raw)) ean13Invalido.push(`${row.name}: ${raw}`)
    }

    // Dos productos con el mismo código: el lector no puede distinguirlos.
    const porCodigo = new Map<string, string[]>()
    for (const row of own) {
      const code = resolveLabelCode(row)
      if (!code) continue
      porCodigo.set(code.value, [...(porCodigo.get(code.value) ?? []), row.name])
    }
    const repetidos = [...porCodigo.entries()].filter(([, names]) => names.length > 1)

    const propias = variantRows.filter((row) => row.organization_id === org.id && row.is_active !== false)
    const variantesSinCodigo = propias.filter((row) => !resolveLabelCode(row))

    return {
      tienda: org.name as string,
      activos: own.length,
      conBarcode,
      soloSku,
      sinNada,
      formatos,
      ean13Invalido,
      noImprimible,
      largos,
      repetidos,
      variantes: propias.length,
      variantesSinCodigo: variantesSinCodigo.length,
      productosConVariantes: own.filter((row) => row.has_variants).length,
    }
  })

  const conProductos = resumen.filter((org) => org.activos > 0)

  console.log('\n=== Qué se puede etiquetar, por tienda ===')
  console.table(
    conProductos.map((org) => ({
      tienda: org.tienda.slice(0, 22),
      activos: org.activos,
      'con código': org.conBarcode,
      'solo SKU': org.soloSku,
      'sin nada': org.sinNada.length,
      'EAN-13 ok': org.formatos.EAN13 ?? 0,
      'Code 128': org.formatos.CODE128 ?? 0,
      repetidos: org.repetidos.length,
      variantes: org.variantes,
      'var. sin código': org.variantesSinCodigo,
    })),
  )

  const total = conProductos.reduce(
    (acc, org) => ({
      activos: acc.activos + org.activos,
      conBarcode: acc.conBarcode + org.conBarcode,
      soloSku: acc.soloSku + org.soloSku,
      sinNada: acc.sinNada + org.sinNada.length,
      ean13: acc.ean13 + (org.formatos.EAN13 ?? 0),
      code128: acc.code128 + (org.formatos.CODE128 ?? 0),
      ean13Invalido: acc.ean13Invalido + org.ean13Invalido.length,
      noImprimible: acc.noImprimible + org.noImprimible.length,
      repetidos: acc.repetidos + org.repetidos.length,
      variantes: acc.variantes + org.variantes,
      variantesSinCodigo: acc.variantesSinCodigo + org.variantesSinCodigo,
    }),
    { activos: 0, conBarcode: 0, soloSku: 0, sinNada: 0, ean13: 0, code128: 0, ean13Invalido: 0, noImprimible: 0, repetidos: 0, variantes: 0, variantesSinCodigo: 0 },
  )
  console.log('\n=== Totales ===')
  console.log(total)

  // ── Cómo son los códigos que hoy se imprimirían ──────────────────────────
  const todos = rows
    .filter((row) => row.is_active !== false)
    .map((row) => ({ row, code: resolveLabelCode(row) }))
    .filter((item): item is { row: ProductRow; code: { value: string; format: string } } => item.code !== null)

  const tramos = { '1-8': 0, '9-13': 0, '14-20': 0, '21-30': 0, '31+': 0 }
  for (const { code } of todos) {
    const n = code.value.length
    if (n <= 8) tramos['1-8'] += 1
    else if (n <= 13) tramos['9-13'] += 1
    else if (n <= 20) tramos['14-20'] += 1
    else if (n <= 30) tramos['21-30'] += 1
    else tramos['31+'] += 1
  }
  console.log('\n=== Largo del código que se imprime (caracteres) ===')
  console.log(tramos)

  const conEspacios = todos.filter(({ code }) => /\s/.test(code.value))
  const skuIgualAlNombre = todos.filter(
    ({ row, code }) => (row.sku ?? '').trim() === code.value && code.value.trim().toLowerCase() === row.name.trim().toLowerCase(),
  )
  console.log('\ncódigos con espacios:', conEspacios.length, '| SKU igual al nombre del producto:', skuIgualAlNombre.length)
  console.log('ejemplos de códigos largos (>20):')
  for (const { row, code } of todos.filter(({ code }) => code.value.length > 20).slice(0, 8)) {
    console.log(`   • ${row.name.slice(0, 34)} → SKU ${JSON.stringify(code.value)} (${code.value.length})`)
  }

  /**
   * ¿Entran las barras en la etiqueta y se pueden leer?
   *
   * Code 128 usa 11 módulos por carácter más 35 de arranque, verificador y
   * cierre; EAN-13 son 95 fijos. El módulo más angosto (la barra fina) no
   * debería bajar de 0,25 mm para un lector de mostrador, y por debajo de
   * 0,19 mm casi ninguno lo toma.
   */
  const modulos = (code: { value: string; format: string }) =>
    code.format === 'CODE128' ? 11 * code.value.length + 35 : 95

  console.log('\n=== Ancho de la barra fina, por formato (mm) ===')
  console.table(
    [
      { formato: 'Rollo 50 × 25', utilMm: 46 - 2 },
      { formato: 'Rollo 40 × 30', utilMm: 36 - 2 },
      { formato: 'Rollo 60 × 40', utilMm: 54 - 2 },
      { formato: 'A4 24 (70 × 37)', utilMm: 70 - 2 },
      { formato: 'A4 40 (52,5 × 29,7)', utilMm: 52.5 - 2 },
    ].map(({ formato, utilMm }) => {
      const anchos = todos.map(({ code }) => utilMm / modulos(code))
      const bajo025 = anchos.filter((mm) => mm < 0.25).length
      const bajo019 = anchos.filter((mm) => mm < 0.19).length
      return {
        formato,
        'mínimo mm': Number(Math.min(...anchos).toFixed(3)),
        'bajo 0,25 mm': `${bajo025} de ${anchos.length}`,
        'bajo 0,19 mm': bajo019,
      }
    }),
  )

  for (const org of conProductos) {
    const detalle: string[] = []
    if (org.sinNada.length) {
      detalle.push(`sin código ni SKU (${org.sinNada.length}): ${org.sinNada.slice(0, 6).map((row) => row.name).join(' | ')}`)
    }
    if (org.repetidos.length) {
      detalle.push(`códigos repetidos: ${org.repetidos.slice(0, 6).map(([code, names]) => `${code} → ${names.join(' / ')}`).join(' ; ')}`)
    }
    if (org.ean13Invalido.length) {
      detalle.push(`13 dígitos con verificador equivocado: ${org.ean13Invalido.slice(0, 6).join(' ; ')}`)
    }
    if (org.noImprimible.length) {
      detalle.push(`no se pueden dibujar: ${org.noImprimible.slice(0, 6).join(' ; ')}`)
    }
    if (org.largos.length) {
      detalle.push(`códigos largos: ${org.largos.slice(0, 6).join(' ; ')}`)
    }
    if (org.variantesSinCodigo) {
      detalle.push(`variantes sin código propio: ${org.variantesSinCodigo} de ${org.variantes}`)
    }
    if (detalle.length) {
      console.log(`\n-- ${org.tienda}`)
      for (const line of detalle) console.log('   •', line)
    }
  }
}

void main()
