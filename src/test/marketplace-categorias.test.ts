import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const CATEGORIAS = leer('src/components/public/CategoriesClient.tsx')
const TARJETA = leer('src/components/public/OrganizationDirectoryCard.tsx')

/**
 * `OrganizationDirectoryCard` tiene un `<span>` con `onClick` y `onKeyDown` para
 * abrir el mapa —es un span y no un `<a>` porque la tarjeta entera ya es un
 * `<Link>`, y anidar anclas es HTML inválido— pero al archivo le faltaba la
 * directiva `'use client'`. Next lo trataba como componente de servidor y
 * fallaba con «Event handlers cannot be passed to Client Component props».
 */
describe('la tarjeta del directorio es un componente de cliente', () => {
  it('declara la directiva', () => {
    expect(TARJETA.startsWith("'use client'")).toBe(true)
  })

  it('sigue teniendo los manejadores que la obligan a serlo', () => {
    // Si algún día se van, la directiva deja de hacer falta —pero mientras
    // estén, sacarla vuelve a romper la página.
    expect(TARJETA).toContain('onClick={(e) => {')
    expect(TARJETA).toContain('onKeyDown={(e) => {')
  })
})

/**
 * Verificado en el navegador a 375px: dos columnas de 166,5px, cuadrícula
 * activa al entrar y la página no desborda. A 1280px, cuatro de 289,5px.
 */
describe('categorías abre en cuadrícula', () => {
  it('la vista por defecto es la cuadrícula', () => {
    // La de ramas obliga a abrir grupo por grupo para ver qué hay.
    expect(CATEGORIAS).toContain("useState<ViewMode>('grid')")
    expect(CATEGORIAS).not.toContain("useState<ViewMode>('branches')")
  })

  it('las dos vistas siguen disponibles', () => {
    expect(CATEGORIAS).toContain("type ViewMode = 'branches' | 'grid'")
    expect(CATEGORIAS).toContain("setViewMode('grid')")
  })
})

describe('entran dos categorías por fila en el teléfono', () => {
  it('la cuadrícula principal', () => {
    expect(CATEGORIAS).toContain('grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4')
  })

  it('la de adentro de cada rama también', () => {
    // Si una queda en una columna, cambiar de vista salta de dos a una.
    expect(CATEGORIAS).toContain('grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4')
  })

  it('ya no quedan grillas de una sola columna', () => {
    expect(CATEGORIAS).not.toContain('grid grid-cols-1 gap-4 sm:grid-cols-2')
    expect(CATEGORIAS).not.toContain('grid grid-cols-1 gap-2.5 sm:grid-cols-2')
  })

  it('en escritorio no cambia', () => {
    // Medido: cuatro columnas de 289,5px a 1280px.
    expect(CATEGORIAS).toContain('md:grid-cols-3 lg:grid-cols-4')
  })
})
