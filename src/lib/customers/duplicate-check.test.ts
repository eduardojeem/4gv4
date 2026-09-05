import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  duplicatesMessage,
  findCustomerDuplicates,
  normalizeDocument,
  normalizeEmail,
  type CustomerDuplicate,
} from './duplicate-check'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

type Consulta = { columna: string; valor: unknown }

let consultas: Consulta[] = []
let filas: Record<string, Array<{ id: string; name: string }>> = {}
/** Columnas que la base no tiene, para simular un despliegue sin la migracion. */
let columnasFaltantes = new Set<string>()

/** Cliente de Supabase de mentira: registra por que columna se pregunto. */
function fakeClient() {
  return {
    from() {
      let columna = ''
      let valor: unknown = null
      const builder: any = {
        select: () => builder,
        limit: () => builder,
        eq(col: string, val: unknown) {
          if (col !== 'organization_id') {
            columna = col
            valor = val
          }
          return builder
        },
        then(onFulfilled: (v: unknown) => unknown) {
          consultas.push({ columna, valor })
          const result = columnasFaltantes.has(columna)
            ? { data: null, error: { code: '42703', message: `column "${columna}" does not exist` } }
            : { data: filas[columna] ?? [], error: null }
          return Promise.resolve(result).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

beforeEach(() => {
  consultas = []
  filas = {}
  columnasFaltantes = new Set()
})

/**
 * El mismo cliente cargado dos veces reparte su deuda, sus compras y sus
 * reparaciones entre fichas distintas. Es el tipo de problema que no se nota el
 * dia que se crea.
 */
describe('duplicados de cliente', () => {
  it('encuentra el mismo número cargado con otro formato', async () => {
    // Es el caso real: "0981-123 456" y "0981123456" son el mismo teléfono, y
    // comparando el texto tal cual no coincide ninguno.
    filas.phone_digits = [{ id: 'c-1', name: 'Ana Pérez' }]

    const encontrados = await findCustomerDuplicates(fakeClient(), 'org-1', { phone: '0981-123 456' })

    expect(consultas).toContainEqual({ columna: 'phone_digits', valor: '0981123456' })
    expect(encontrados).toHaveLength(1)
    expect(encontrados[0]).toMatchObject({ field: 'phone', customerId: 'c-1', customerName: 'Ana Pérez' })
  })

  it('compara el correo sin importar mayúsculas', async () => {
    filas.email_lower = [{ id: 'c-2', name: 'Comercial Sur' }]

    const encontrados = await findCustomerDuplicates(fakeClient(), 'org-1', { email: '  Ventas@Sur.COM ' })

    expect(consultas).toContainEqual({ columna: 'email_lower', valor: 'ventas@sur.com' })
    expect(encontrados[0].field).toBe('email')
  })

  it('encuentra el mismo RUC con y sin guión', async () => {
    filas.ruc_digits = [{ id: 'c-3', name: 'Taller Norte' }]

    await findCustomerDuplicates(fakeClient(), 'org-1', { ruc: '80012345-6' })

    expect(consultas).toContainEqual({ columna: 'ruc_digits', valor: '800123456' })
  })

  it('no marca al propio cliente al editarlo', async () => {
    // Sin esto, guardar un cliente sin cambiarle nada seria imposible.
    filas.phone_digits = [{ id: 'c-1', name: 'Ana Pérez' }]

    const encontrados = await findCustomerDuplicates(fakeClient(), 'org-1', {
      phone: '0981123456',
      excludeId: 'c-1',
    })

    expect(encontrados).toEqual([])
  })

  it('no consulta nada si no hay ningún dato comparable', async () => {
    const encontrados = await findCustomerDuplicates(fakeClient(), 'org-1', { phone: '', email: '', ruc: null })

    expect(consultas).toEqual([])
    expect(encontrados).toEqual([])
  })

  it('sigue funcionando en un despliegue sin la migración', async () => {
    // Sin las columnas normalizadas compara el texto tal cual: encuentra menos
    // —no ve el mismo número con otro formato— pero no revienta el alta.
    columnasFaltantes.add('phone_digits')
    filas.phone = [{ id: 'c-9', name: 'Ana Pérez' }]

    const encontrados = await findCustomerDuplicates(fakeClient(), 'org-1', { phone: '0981123456' })

    expect(consultas.map((c) => c.columna)).toEqual(['phone_digits', 'phone'])
    expect(encontrados).toHaveLength(1)
  })

  it('normaliza sin inventar valores', () => {
    expect(normalizeDocument('80012345-6')).toBe('800123456')
    expect(normalizeDocument(null)).toBe('')
    expect(normalizeEmail('  A@B.com ')).toBe('a@b.com')
    expect(normalizeEmail(undefined)).toBe('')
  })
})

/**
 * Decir solo "ya existe" obliga a salir a buscarlo a mano, y en la practica se
 * termina creando el duplicado igual con un digito cambiado.
 */
describe('el aviso nombra al cliente que ya lo tiene', () => {
  const dup = (field: CustomerDuplicate['field'], name: string): CustomerDuplicate =>
    ({ field, value: 'x', customerId: `id-${name}`, customerName: name })

  it('nombra al cliente en el caso de un solo campo', () => {
    expect(duplicatesMessage([dup('phone', 'Ana Pérez')]))
      .toBe('Ese teléfono ya está cargado en «Ana Pérez».')
  })

  it('agrupa cuando es el mismo cliente', () => {
    expect(duplicatesMessage([dup('phone', 'Ana Pérez'), dup('email', 'Ana Pérez')]))
      .toBe('El teléfono y el correo ya están cargados en «Ana Pérez».')
  })

  it('lista los dos cuando son clientes distintos', () => {
    const mensaje = duplicatesMessage([dup('phone', 'Ana Pérez'), dup('email', 'Comercial Sur')])
    expect(mensaje).toContain('«Ana Pérez»')
    expect(mensaje).toContain('«Comercial Sur»')
  })

  it('no dice nada cuando no hay duplicados', () => {
    expect(duplicatesMessage([])).toBe('')
  })
})

/**
 * El aviso mientras se escribe es una cortesia: quien decide es el servidor. Sin
 * esto seria una sugerencia que se saltea desactivando JavaScript, y ademas hay
 * una ventana entre el aviso y el guardado.
 */
describe('los cuatro endpoints de escritura lo rechazan', () => {
  for (const ruta of ['src/app/api/customers/route.ts', 'src/app/api/repairs/customers/route.ts']) {
    it(`${ruta} lo comprueba al crear y al editar`, () => {
      const archivo = leer(ruta)
      expect([...archivo.matchAll(/await findCustomerDuplicates\(/g)]).toHaveLength(2)
      expect([...archivo.matchAll(/CUSTOMER_DUPLICATE/g)]).toHaveLength(2)
      expect(archivo).toContain('status: 409')
    })

    it(`${ruta} excluye al propio cliente al editar`, () => {
      expect(leer(ruta)).toContain('excludeId: id,')
    })
  }

  it('el endpoint de aviso falla abierto', () => {
    // Bloquear el formulario porque la comprobacion no anduvo seria peor que
    // dejar pasar: el guardado igual lo va a rechazar con el motivo.
    const archivo = leer('src/app/api/customers/check-duplicate/route.ts')
    expect(archivo).toContain('duplicates: [] }, { status: 200 }')
  })
})

describe('los formularios avisan antes de guardar', () => {
  for (const [nombre, ruta] of [
    ['alta rápida', 'src/components/dashboard/repairs/CustomerQuickCreateDialog.tsx'],
    ['sección de clientes', 'src/components/dashboard/customer-form-simple.tsx'],
  ] as const) {
    it(`${nombre} muestra el aviso`, () => {
      const archivo = leer(ruta)
      expect(archivo).toContain('useCustomerDuplicates(')
      expect(archivo).toContain('duplicatesMessage(duplicates)')
      expect(archivo).toContain('excludeId:')
    })
  }
})
