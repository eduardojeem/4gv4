import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  describeDeviceCompatibility,
  deviceSortKey,
  normalizeDeviceBrand,
  normalizeDeviceModel,
  normalizeDeviceModels,
  usesDeviceCompatibility,
} from '@/lib/products/device-compatibility'
import { buildDeviceOptions } from '@/lib/products/device-options'
import { deviceFieldsFrom, hasDeviceContent, persistDeviceFields } from '@/lib/products/device-persist'
import { forgetDeviceColumnsCheck, productsHaveDeviceColumns } from '@/lib/products/device-columns'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'
import { DeviceCompatibilityFields } from '@/components/dashboard/products/DeviceCompatibilityFields'
import { DeviceFilterFields } from '@/components/dashboard/products/DeviceFilterFields'

/**
 * Un repuesto tiene tres datos que el catálogo mezclaba en dos campos: la marca
 * del celular, el modelo del celular y la marca del repuesto. En 4G celulares,
 * «pantalla a12» tenía marca Samsung y «OLED Assembly For iPhone 13» tenía marca
 * «Aftermarket Plus: Soft 3.0», y el modelo sólo estaba en el nombre, escrito
 * cada vez distinto. Así no se podía ordenar por modelo.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  forgetDeviceColumnsCheck()
})

describe('la marca del celular se escribe siempre igual', () => {
  it('unifica mayúsculas y los errores de tipeo del catálogo real', () => {
    expect(normalizeDeviceBrand('samsung')).toBe('Samsung')
    expect(normalizeDeviceBrand('SAMSUNG')).toBe('Samsung')
    expect(normalizeDeviceBrand('Sansung')).toBe('Samsung')
    expect(normalizeDeviceBrand('  apple ')).toBe('Apple')
  })

  it('«iphone» como marca es Apple, y Redmi es Xiaomi', () => {
    expect(normalizeDeviceBrand('iphone')).toBe('Apple')
    expect(normalizeDeviceBrand('redmi')).toBe('Xiaomi')
  })

  it('una marca que no conoce queda con mayúscula inicial', () => {
    expect(normalizeDeviceBrand('blackview')).toBe('Blackview')
    expect(normalizeDeviceBrand('huawei/honor')).toBe('Huawei/Honor')
  })

  it('vacía es null', () => {
    expect(normalizeDeviceBrand('   ')).toBeNull()
    expect(normalizeDeviceBrand(null)).toBeNull()
  })
})

describe('el modelo del celular se escribe siempre igual', () => {
  it('iPhone con sus palabras', () => {
    expect(normalizeDeviceModel('iphone 13 pro max')).toBe('iPhone 13 Pro Max')
    expect(normalizeDeviceModel('IPHONE 12 PRO')).toBe('iPhone 12 Pro')
    expect(normalizeDeviceModel('iphone se')).toBe('iPhone SE')
  })

  it('los códigos de modelo van en mayúscula', () => {
    expect(normalizeDeviceModel('a15')).toBe('A15')
    expect(normalizeDeviceModel('x7b')).toBe('X7B')
    expect(normalizeDeviceModel('redmi note 12s')).toBe('Redmi Note 12S')
  })

  /** No inventa: si el local escribe «A15» no lo convierte en «Galaxy A15». */
  it('no agrega ni saca palabras', () => {
    expect(normalizeDeviceModel('A15')).toBe('A15')
    expect(normalizeDeviceModel('galaxy a15')).toBe('Galaxy A15')
  })

  it('una lista sin repetidos aunque estén escritos distinto', () => {
    expect(normalizeDeviceModels(['iphone 12', 'iPhone 12', 'IPHONE 12', 'iphone 12 pro', ''])).toEqual([
      'iPhone 12',
      'iPhone 12 Pro',
    ])
  })

  it('tiene un tope de 20 modelos', () => {
    expect(normalizeDeviceModels(Array.from({ length: 30 }, (_, i) => `A${i}`))).toHaveLength(20)
  })
})

describe('mostrar y ordenar por celular', () => {
  it('se muestra como «Apple · iPhone 12, iPhone 12 Pro»', () => {
    expect(describeDeviceCompatibility('Apple', ['iPhone 12', 'iPhone 12 Pro'])).toBe('Apple · iPhone 12, iPhone 12 Pro')
    expect(describeDeviceCompatibility('Samsung', [])).toBe('Samsung')
    expect(describeDeviceCompatibility(null, [])).toBeNull()
  })

  /** Ordenado como texto, «iPhone 11» caería antes que «iPhone 8». */
  it('iPhone 8 va antes que iPhone 11', () => {
    const ordenados = [['Apple', ['iPhone 11']], ['Apple', ['iPhone 8']], ['Apple', ['iPhone 13']]]
      .sort((a, b) => deviceSortKey(a[0] as string, a[1] as string[]).localeCompare(deviceSortKey(b[0] as string, b[1] as string[])))
      .map((x) => (x[1] as string[])[0])
    expect(ordenados).toEqual(['iPhone 8', 'iPhone 11', 'iPhone 13'])
  })

  it('los productos sin celular van al final', () => {
    expect(deviceSortKey(null, []) > deviceSortKey('Samsung', ['A15'])).toBe(true)
  })

  it('la base ordena con la misma regla que la pantalla', () => {
    const sql = leer('supabase/migrations/20260922120000_products_device_compatibility.sql')
    expect(sql).toContain("lpad(t.parte[1], 6, '0')")
    expect(leer('src/lib/products/device-compatibility.ts')).toContain("padStart(6, '0')")
  })
})

describe('las sugerencias salen de productos y reparaciones', () => {
  it('juntan lo mismo escrito distinto, y lo más usado va primero', () => {
    const opciones = buildDeviceOptions({
      productos: [{ device_brand: 'Apple', device_models: ['iPhone 13'] }],
      reparaciones: [
        { device_brand: 'apple', device_model: 'iphone 13' },
        { device_brand: 'Sansung', device_model: 'a05' },
        { device_brand: 'samsung', device_model: 'A05' },
        { device_brand: 'Samsung', device_model: 'A15' },
        { device_brand: 'Samsung', device_model: null },
      ],
    })

    expect(opciones.brands).toEqual(['Samsung', 'Apple'])
    expect(opciones.modelsByBrand.Samsung).toEqual(['A05', 'A15'])
    expect(opciones.modelsByBrand.Apple).toEqual(['iPhone 13'])
  })
})

describe('validar lo que llega a la API', () => {
  const base = { name: 'Pantalla iPhone 13', sku: 'PAN-I13', sale_price: 350000, purchase_price: 200000 }

  it('normaliza al crear', () => {
    const r = productSchema.safeParse({ ...base, device_brand: 'sansung', device_models: ['a15', 'A15', 'a16'] })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.device_brand).toBe('Samsung')
    expect(r.data.device_models).toEqual(['A15', 'A16'])
  })

  /** Una edición que no manda el celular no lo tiene que borrar. */
  it('una edición sin estos campos no los toca', () => {
    const r = productUpdateSchema.safeParse({ id: '11111111-1111-4111-8111-111111111111', visibility: 'hidden' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect('device_brand' in r.data ? r.data.device_brand : undefined).toBeUndefined()
    expect('device_models' in r.data ? r.data.device_models : undefined).toBeUndefined()
  })

  it('rechaza más de 20 modelos', () => {
    const r = productSchema.safeParse({ ...base, device_models: Array.from({ length: 21 }, (_, i) => `M${i}`) })
    expect(r.success).toBe(false)
  })
})

describe('guardar el celular sin romper nada antes de la migración', () => {
  const cliente = ({ columnas = true, errorUpdate = null }: { columnas?: boolean; errorUpdate?: { message: string } | null } = {}) => {
    const actualizaciones: Array<{ valores: Record<string, unknown>; filtros: Array<[string, string]> }> = []
    const c = {
      from: () => ({
        select: () => ({ limit: async () => ({ error: columnas ? null : { message: 'column device_brand does not exist' } }) }),
        update: (valores: Record<string, unknown>) => {
          const filtros: Array<[string, string]> = []
          actualizaciones.push({ valores, filtros })
          return {
            eq: (col: string, val: string) => {
              filtros.push([col, val])
              return {
                eq: async (col2: string, val2: string) => {
                  filtros.push([col2, val2])
                  return { error: errorUpdate }
                },
              }
            },
          }
        },
      }),
    }
    return { c, actualizaciones }
  }

  it('sólo toma lo que vino en el pedido', () => {
    expect(deviceFieldsFrom({})).toBeNull()
    expect(deviceFieldsFrom({ device_brand: 'Apple' })).toEqual({ device_brand: 'Apple' })
    expect(hasDeviceContent({ device_brand: null, device_models: [] })).toBe(false)
  })

  it('con las columnas, lo escribe acotado a la organización', async () => {
    const { c, actualizaciones } = cliente()
    const r = await persistDeviceFields(c as never, {
      productId: 'p1',
      organizationId: 'org',
      validated: { device_brand: 'Apple', device_models: ['iPhone 13'] },
    })
    expect(r).toEqual({ campos: { device_brand: 'Apple', device_models: ['iPhone 13'] }, skipped: false })
    expect(actualizaciones[0].filtros).toEqual([['id', 'p1'], ['organization_id', 'org']])
  })

  /** El formulario manda los campos vacíos siempre: sin nada cargado, no hay aviso. */
  it('sin las columnas y sin nada cargado, no avisa ni escribe', async () => {
    const { c, actualizaciones } = cliente({ columnas: false })
    const r = await persistDeviceFields(c as never, {
      productId: 'p1',
      organizationId: 'org',
      validated: { device_brand: null, device_models: [] },
    })
    expect(r).toEqual({ campos: null, skipped: false })
    expect(actualizaciones).toHaveLength(0)
  })

  it('sin las columnas y con celular cargado, guarda el producto y lo avisa', async () => {
    const { c, actualizaciones } = cliente({ columnas: false })
    const r = await persistDeviceFields(c as never, {
      productId: 'p1',
      organizationId: 'org',
      validated: { device_brand: 'Apple', device_models: ['iPhone 13'] },
    })
    expect(r.skipped).toBe(true)
    expect(actualizaciones).toHaveLength(0)
  })

  it('el «sí» se recuerda; el «no» se vuelve a preguntar', async () => {
    let consultas = 0
    const c = (hay: boolean) => ({
      from: () => ({ select: () => ({ limit: async () => { consultas++; return { error: hay ? null : { message: 'x' } } } }) }),
    })
    expect(await productsHaveDeviceColumns(c(true) as never)).toBe(true)
    expect(await productsHaveDeviceColumns(c(false) as never)).toBe(true)
    expect(consultas).toBe(1)
  })
})

describe('el formulario: ¿para qué celular es?', () => {
  const OPCIONES = { brands: ['Apple', 'Samsung'], modelsByBrand: { Apple: ['iPhone 13', 'iPhone 12'], Samsung: ['A15'] } }

  const montar = (props: Partial<React.ComponentProps<typeof DeviceCompatibilityFields>> = {}) => {
    const onBrandChange = vi.fn()
    const onModelsChange = vi.fn()
    render(
      <DeviceCompatibilityFields
        brand=""
        models={[]}
        onBrandChange={onBrandChange}
        onModelsChange={onModelsChange}
        options={OPCIONES}
        {...props}
      />,
    )
    return { onBrandChange, onModelsChange }
  }

  it('pregunta marca y modelos del celular', () => {
    montar()
    expect(screen.getByLabelText('Marca del celular')).toBeInTheDocument()
    expect(screen.getByLabelText('Modelos del celular')).toBeInTheDocument()
  })

  it('al salir del campo unifica la marca', () => {
    const { onBrandChange } = montar({ brand: 'sansung' })
    fireEvent.blur(screen.getByLabelText('Marca del celular'))
    expect(onBrandChange).toHaveBeenLastCalledWith('Samsung')
  })

  it('un modelo se agrega con Enter, ya normalizado', async () => {
    const { onModelsChange } = montar({ brand: 'Apple' })
    await userEvent.type(screen.getByLabelText('Modelos del celular'), 'iphone 13 pro{Enter}')
    expect(onModelsChange).toHaveBeenLastCalledWith(['iPhone 13 Pro'])
  })

  it('no agrega un modelo que ya está', async () => {
    const { onModelsChange } = montar({ brand: 'Apple', models: ['iPhone 13'] })
    await userEvent.type(screen.getByLabelText('Modelos del celular'), 'IPHONE 13{Enter}')
    expect(onModelsChange).toHaveBeenLastCalledWith(['iPhone 13'])
  })

  it('sugiere los modelos ya usados de esa marca', async () => {
    const { onModelsChange } = montar({ brand: 'Apple', models: ['iPhone 13'] })
    // El que ya está no se vuelve a sugerir.
    expect(screen.queryByRole('button', { name: '+ iPhone 13' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ iPhone 12' }))
    expect(onModelsChange).toHaveBeenLastCalledWith(['iPhone 13', 'iPhone 12'])
  })

  it('un modelo se puede quitar', async () => {
    const { onModelsChange } = montar({ brand: 'Apple', models: ['iPhone 13', 'iPhone 12'] })
    await userEvent.click(screen.getByRole('button', { name: 'Quitar iPhone 12' }))
    expect(onModelsChange).toHaveBeenLastCalledWith(['iPhone 13'])
  })
})

describe('el filtro del listado', () => {
  const OPCIONES = { brands: ['Apple'], modelsByBrand: { Apple: ['iPhone 13'] }, columnsReady: true }

  /** Antes de la migración la API ignoraría el filtro: mejor no mostrarlo. */
  it('no aparece si la base todavía no tiene las columnas', () => {
    const { container } = render(<DeviceFilterFields onChange={vi.fn()} options={{ ...OPCIONES, columnsReady: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('el modelo aparece recién con la marca elegida', () => {
    const { rerender } = render(<DeviceFilterFields onChange={vi.fn()} options={OPCIONES} />)
    expect(screen.getByLabelText('Marca del celular')).toBeInTheDocument()
    expect(screen.queryByLabelText('Modelo del celular')).not.toBeInTheDocument()

    rerender(<DeviceFilterFields deviceBrand="Apple" onChange={vi.fn()} options={OPCIONES} />)
    expect(screen.getByLabelText('Modelo del celular')).toBeInTheDocument()
  })
})

describe('todo conectado', () => {
  const route = leer('src/app/api/products/route.ts')

  it('los cuatro caminos de guardado escriben el celular', () => {
    expect(route.match(/await persistDeviceFields\(/g) ?? []).toHaveLength(4)
  })

  it('filtrar y ordenar por celular sólo si la base tiene las columnas', () => {
    expect(route).toContain("device: 'device_sort_key'")
    expect(route).toContain('puedeUsarCelular && deviceModelFilter')
    expect(route).toContain(".contains('device_models', [deviceModelFilter])")
  })

  it('el formulario pregunta el celular y aclara la marca del repuesto', () => {
    const modal = leer('src/components/dashboard/product-modal.tsx')
    expect(modal).toContain('<DeviceCompatibilityFields')
    expect(modal).toContain('Marca del repuesto')
  })

  it('el listado muestra el celular y ordena por él', () => {
    const tabla = leer('src/components/dashboard/products-modern/ProductTable.tsx')
    expect(tabla).toContain('describeDeviceCompatibility(product.device_brand, product.device_models)')
    expect(tabla).toContain('field="device_model"')
  })
})

/**
 * «¿Para qué celular es?» sólo le sirve a quien vende o repara celulares. A una
 * tienda de ropa o de muebles le agregaba un bloque que no entiende, y «marca
 * del repuesto» no tiene sentido para una remera.
 */
describe('quién ve la marca y el modelo del celular', () => {
  it('los negocios de tecnología', () => {
    expect(usesDeviceCompatibility({ businessVertical: 'electronics', operatingModel: 'retail' })).toBe(true)
  })

  it('los talleres, aunque su rubro diga otra cosa', () => {
    expect(usesDeviceCompatibility({ businessVertical: 'general', operatingModel: 'repair' })).toBe(true)
  })

  it('una tienda de ropa o de rubro general no', () => {
    expect(usesDeviceCompatibility({ businessVertical: 'clothing', operatingModel: 'mixed' })).toBe(false)
    expect(usesDeviceCompatibility({ businessVertical: 'general', operatingModel: 'retail' })).toBe(false)
    expect(usesDeviceCompatibility({})).toBe(false)
  })

  it('el formulario, la tabla y los filtros usan la misma regla', () => {
    for (const ruta of [
      'src/components/dashboard/product-modal.tsx',
      'src/components/dashboard/products-modern/ProductTable.tsx',
      'src/components/dashboard/products-modern/FilterPanel.tsx',
    ]) {
      const codigo = leer(ruta)
      expect(codigo, ruta).toContain('usesDeviceCompatibility({ businessVertical, operatingModel })')
      expect(codigo, ruta).toContain('muestraCelular &&')
    }
  })

  it('para los demás la marca vuelve a llamarse «Marca»', () => {
    expect(leer('src/components/dashboard/product-modal.tsx')).toContain("muestraCelular ? 'Marca del repuesto' : 'Marca'")
    expect(leer('src/components/dashboard/products-modern/FilterPanel.tsx')).toContain("muestraCelular ? 'Marca del repuesto' : 'Marca'")
  })
})
