import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { routeParam } from '@/lib/api/route-params'

/**
 * En Next 16 el segundo argumento de un handler trae `params` como promesa.
 * Cinco rutas lo leían como objeto (`context.params?.id`), que siempre da
 * `undefined`: devolvían 400 «Falta el sorteo» antes de tocar la base. Con eso
 * roto no se podía publicar un sorteo, ver sus participantes, canjear números,
 * sortear ni activar una regla de puntos.
 */

describe('el parámetro de una ruta dinámica', () => {
  it('lo saca de la promesa, que es como llega en Next 16', async () => {
    expect(await routeParam({ params: Promise.resolve({ id: 'abc' }) }, 'id')).toBe('abc')
  })

  it('y también del objeto plano, como llega en los tests', async () => {
    expect(await routeParam({ params: { id: 'abc' } }, 'id')).toBe('abc')
  })

  it('sirve para cualquier nombre de parámetro', async () => {
    expect(await routeParam({ params: Promise.resolve({ customerId: 'c1' }) }, 'customerId')).toBe('c1')
  })

  it('una ruta atrapa-todo devuelve el primer tramo', async () => {
    expect(await routeParam({ params: Promise.resolve({ slug: ['uno', 'dos'] }) }, 'slug')).toBe('uno')
  })

  it('sin contexto, sin parámetro o vacío devuelve null', async () => {
    expect(await routeParam(undefined, 'id')).toBeNull()
    expect(await routeParam({}, 'id')).toBeNull()
    expect(await routeParam({ params: Promise.resolve({}) }, 'id')).toBeNull()
    expect(await routeParam({ params: Promise.resolve({ id: '' }) }, 'id')).toBeNull()
  })
})

/** Guarda para que no vuelva a aparecer el patrón sincrónico en ninguna ruta. */
describe('ninguna ruta lee params sin esperarlo', () => {
  const rutas: string[] = []
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (entrada === 'route.ts') rutas.push(ruta)
    }
  }
  recorrer(resolve(process.cwd(), 'src/app/api'))

  it('encuentra las rutas para revisar', () => {
    expect(rutas.length).toBeGreaterThan(50)
  })

  it('no queda ninguna leyendo `.params?.<algo>` sin await', () => {
    const culpables = rutas.filter((ruta) => {
      const codigo = readFileSync(ruta, 'utf8')
      // `(context as {...}).params?.id`: lee el parámetro de la promesa sin esperarla.
      if (/\)\??\.params\?\.\w+/.test(codigo)) return true
      // O lo guarda en una variable y lo lee igual, sin resolverla antes.
      const castea = /as \{[^}]*params\?:/.test(codigo)
      const espera = /await Promise\.resolve\(params\)|await routeParam|await params/.test(codigo)
      return castea && !espera
    })
    expect(culpables).toEqual([])
  })

  it('las rutas del sorteo usan el helper', () => {
    for (const ruta of [
      'src/app/api/raffles/[id]/route.ts',
      'src/app/api/raffles/[id]/draw/route.ts',
      'src/app/api/raffles/[id]/tickets/route.ts',
      'src/app/api/raffles/[id]/tickets/purchase/route.ts',
      'src/app/api/loyalty/rules/[id]/route.ts',
    ]) {
      const codigo = readFileSync(resolve(process.cwd(), ruta), 'utf8')
      expect(codigo, ruta).toContain("await routeParam(")
    }
  })
})
