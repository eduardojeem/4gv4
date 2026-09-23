import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  forgetHidePriceColumnCheck,
  hidesPublicPrice,
  persistPriceVisibility,
  productsHaveHidePriceColumn,
} from '@/lib/products/price-visibility'
import { buildProductWhatsAppMessage } from '@/lib/whatsapp'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'

/**
 * Una tienda de repuestos quiere el catálogo a la vista pero el precio no: lo
 * negocia por WhatsApp y la competencia lo lee igual que el cliente. Antes la
 * única salida era ocultar el producto entero, así que el cliente ni se
 * enteraba de que existía.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const TARJETA = leer('src/components/public/ProductCard.tsx')
const FICHA = leer('src/app/(public)/productos/[id]/client-components.tsx')
const CATALOGO = leer('src/lib/api/products-server.ts')
const FORMULARIO = leer('src/components/dashboard/product-modal.tsx')
const MODAL_PRECIO = leer('src/components/public/PriceAccessDialog.tsx')
const AYUDA = leer('src/components/dashboard/products/VisibilityHelpDialog.tsx')
const MIGRACION = leer('supabase/migrations/20260923090000_products_hide_price.sql')

afterEach(() => {
  forgetHidePriceColumnCheck()
})

const clienteConColumna = (existe: boolean, alActualizar?: (valores: Record<string, unknown>) => void) => ({
  from: () => ({
    select: () => ({ limit: async () => ({ error: existe ? null : { message: 'column does not exist' } }) }),
    update: (valores: Record<string, unknown>) => {
      alActualizar?.(valores)
      return { eq: () => ({ eq: async () => ({ error: null }) }) }
    },
  }),
})

describe('qué es «publicado sin precio»', () => {
  it('sólo esconde el precio: el producto sigue siendo público', () => {
    // No toca `visibility`: se lista, se filtra y se busca como cualquier otro.
    expect(MIGRACION).toContain('add column if not exists hide_price boolean not null default false')
    expect(MIGRACION).not.toMatch(/visibility/)
  })

  it('los productos que ya existían conservan su precio a la vista', () => {
    // La columna nace en false y recién después cambia el default: si naciera
    // en true, cada tienda amanecía con todo el catálogo sin precio.
    const creacion = MIGRACION.indexOf('default false')
    const nuevoDefault = MIGRACION.indexOf('set default true')
    expect(creacion).toBeGreaterThan(-1)
    expect(nuevoDefault).toBeGreaterThan(creacion)
  })

  it('sin el dato cargado el precio se muestra', () => {
    expect(hidesPublicPrice(null)).toBe(false)
    expect(hidesPublicPrice({})).toBe(false)
    expect(hidesPublicPrice({ hide_price: false })).toBe(false)
    expect(hidesPublicPrice({ hide_price: true })).toBe(true)
  })
})

describe('guardar la decisión', () => {
  it('se escribe en el producto', async () => {
    const escrito: Record<string, unknown>[] = []
    const r = await persistPriceVisibility(clienteConColumna(true, (v) => escrito.push(v)) as never, {
      productId: 'p1',
      organizationId: 'o1',
      validated: { hide_price: true },
    })
    expect(escrito).toEqual([{ hide_price: true }])
    expect(r).toEqual({ campos: { hide_price: true }, skipped: false })
  })

  it('una edición que no lo manda no lo cambia', async () => {
    const escrito: Record<string, unknown>[] = []
    const r = await persistPriceVisibility(clienteConColumna(true, (v) => escrito.push(v)) as never, {
      productId: 'p1',
      organizationId: 'o1',
      validated: {},
    })
    expect(escrito).toEqual([])
    expect(r.campos).toBeNull()
  })

  it('sin la migración aplicada avisa, pero sólo a quien pidió ocultarlo', async () => {
    const sinColumna = clienteConColumna(false)
    const ocultar = await persistPriceVisibility(sinColumna as never, {
      productId: 'p1',
      organizationId: 'o1',
      validated: { hide_price: true },
    })
    expect(ocultar).toEqual({ campos: null, skipped: true })

    forgetHidePriceColumnCheck()
    const mostrar = await persistPriceVisibility(clienteConColumna(false) as never, {
      productId: 'p1',
      organizationId: 'o1',
      validated: { hide_price: false },
    })
    // Pedir que se muestre es lo que ya pasa: avisar seria ruido.
    expect(mostrar).toEqual({ campos: null, skipped: false })
  })

  it('el «sí» de la columna se recuerda y no se vuelve a preguntar', async () => {
    let consultas = 0
    const cliente = {
      from: () => ({
        select: () => ({ limit: async () => { consultas += 1; return { error: null } } }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }),
    }
    await productsHaveHidePriceColumn(cliente as never)
    await productsHaveHidePriceColumn(cliente as never)
    expect(consultas).toBe(1)
  })

  it('la validación lo acepta sin default: un update parcial no lo pisa', () => {
    expect(productSchema.safeParse({
      name: 'Pantalla', sku: 'P1', sale_price: 1000, purchase_price: 500, hide_price: true,
    }).success).toBe(true)

    // Sin `default`, una edicion que no lo manda no lo trae de vuelta: es lo
    // que evita que cambiar el nombre vuelva a publicar el precio.
    const parcial = productUpdateSchema.safeParse({
      id: '3f0c6b1e-6a6f-4f1a-9f6a-0b1f2c3d4e5f',
      name: 'Otro nombre',
    })
    expect(parcial.success).toBe(true)
    expect(parcial.success && 'hide_price' in parcial.data).toBe(false)
  })
})

describe('lo que ve el cliente en la tienda', () => {
  it('la tarjeta cambia el precio por «Preguntar»', () => {
    expect(TARJETA).toContain('const precioOculto = hidesPublicPrice(product)')
    expect(TARJETA).toContain('Precio a consultar')
    expect(TARJETA).toContain('{precioOculto && whatsappHref && (')
    expect(TARJETA).toContain('<span>Preguntar</span>')
  })

  it('y no deja comprar lo que no tiene precio publicado', () => {
    // Agregar al carrito mostraria el precio en el carrito.
    expect(TARJETA).toContain("{!precioOculto && commerceMode === 'cart' && (")
    expect(TARJETA).toContain("{!precioOculto && commerceMode === 'whatsapp' && whatsappHref && (")
    expect(TARJETA).toContain('{!precioOculto && installmentsVisible')
  })

  it('la ficha del producto hace lo mismo', () => {
    expect(FICHA).toContain('const precioOculto = hidesPublicPrice(product)')
    expect(FICHA).toContain('Preguntar el precio por WhatsApp')
    expect(FICHA).toContain("{!precioOculto && commerceMode === 'cart' && (")
  })

  it('el mensaje de WhatsApp tampoco lleva el precio', () => {
    // Seria absurdo esconderlo en la tarjeta y mandarlo en el mensaje.
    expect(TARJETA).toContain('price: precioOculto ? 0 : displayPrice')
    expect(TARJETA).toContain('price: precioOculto ? 0 : selectedPrice')
    expect(FICHA).toContain('price={precioOculto ? 0 : displayPrice}')

    const mensaje = buildProductWhatsAppMessage({
      storeName: '4G celulares',
      productName: 'Pantalla iPhone 13',
      price: 0,
      intent: 'price',
    })
    expect(mensaje).toContain('Quiero consultar el precio de este producto')
    expect(mensaje).not.toContain('Precio:')
  })

  it('la consulta pública trae el dato, y sin la columna no rompe el catálogo', () => {
    expect(CATALOGO).toContain("conPrecioOculto ? ', hide_price' : ''")
    expect(CATALOGO).toContain('hide_price: p.hide_price === true')
  })
})

describe('el mayorista registrado sí ve el precio', () => {
  it('el catálogo sólo lo esconde para el público general', () => {
    // Al mayorista no se le esconde nada: entra con su lista propia. Se
    // resuelve en el servidor, asi vale para la tarjeta, la ficha y el carrito.
    expect(CATALOGO).toContain('hide_price: p.hide_price === true && !isWholesale')
    expect(CATALOGO.match(/hide_price: p\.hide_price === true && !isWholesale/g)).toHaveLength(2)
  })

  it('al visitante le ofrece «Ver precio», que explica cómo verlos', () => {
    expect(TARJETA).toContain('<PriceAccessDialog')
    expect(FICHA).toContain('<PriceAccessDialog')
    expect(MODAL_PRECIO).toContain('Los precios son para clientes registrados')
    expect(MODAL_PRECIO).toContain('Crear mi cuenta')
    expect(MODAL_PRECIO).toContain('Ya tengo cuenta')
  })

  it('a quien ya inició sesión no le pide registrarse otra vez', () => {
    // Lo que le falta es la habilitación del precio mayorista, no la cuenta.
    expect(MODAL_PRECIO).toContain('const conSesion = Boolean(user)')
    expect(MODAL_PRECIO).toContain('todavía no tiene habilitado el precio mayorista')
    expect(MODAL_PRECIO).toContain('{!conSesion && (')
  })

  it('lleva al registro de la tienda, no al del sistema', () => {
    expect(MODAL_PRECIO).toContain("`${tenantPrefix}/cliente/login`")
    expect(MODAL_PRECIO).toContain("`${tenantPrefix}/cliente/registro`")
  })
})

describe('lo que ve el negocio al cargar un producto', () => {
  it('los productos nuevos nacen sin precio publicado', () => {
    expect(MIGRACION).toContain('alter column hide_price set default true')
    expect(FORMULARIO).toContain('hide_price: true')
  })

  it('editar uno existente respeta lo que ya tenía', () => {
    // Sin atarse al nombre de la variable: lo que importa es que el valor
    // guardado sea el que vuelve al formulario.
    expect(FORMULARIO).toMatch(/hide_price: \w+\.hide_price === true/)
  })

  it('se elige en el mismo selector de visibilidad, no en un interruptor aparte', () => {
    // La etiqueta dice a quién le muestra el precio, no sólo que lo esconde.
    expect(FORMULARIO).toContain('<SelectItem value="public_no_price">Público — precio solo para mayoristas</SelectItem>')
    // «Publico sin precio» es `public` + `hide_price`: la visibilidad no cambia.
    expect(FORMULARIO).toContain("field.onChange(valor === 'public_no_price' ? 'public' : valor)")
    expect(FORMULARIO).toContain("setValue('hide_price', valor === 'public_no_price', { shouldDirty: true })")
    // Y un producto ya guardado vuelve a mostrar la opcion correcta.
    expect(FORMULARIO).toContain("visibilidad === 'public' && ocultaPrecio ? 'public_no_price' : visibilidad")
  })

  it('la explicación está a un clic, no abierta empujando el formulario', () => {
    expect(FORMULARIO).toContain('<VisibilityHelpDialog />')
    // Ya no vive abierta debajo del selector.
    expect(FORMULARIO).not.toContain('Cómo funciona esta sección')
  })

  it('y explica qué hace cada opción, incluido el mayorista', () => {
    expect(AYUDA).toContain('Cómo funciona esta sección')
    expect(AYUDA).toContain('Público — precio solo para mayoristas:')
    expect(AYUDA).toContain('Lo ve tu cliente mayorista')
    // Registrarse no alcanza: el permiso lo habilita la tienda.
    expect(AYUDA).toContain('vos habilitás a cada cliente')
    expect(AYUDA).toContain('Los productos nuevos se cargan con el')
  })
})
