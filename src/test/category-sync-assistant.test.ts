import { describe, expect, it } from 'vitest'
import {
  analyzeSingleCategory,
  analyzeUnlinkedBatch,
  extractSignificantTokens,
  groupUnlinkedCategoriesByContext,
  normalizeCategoryText,
  singularizeWord,
  type UnlinkedCategoryInput,
} from '@/lib/categories/category-sync-assistant'
import { type GlobalCategory } from '@/lib/categories/global-catalog'

const MOCK_CATALOG: GlobalCategory[] = [
  {
    id: 'cat-1',
    name: 'Telefonía y Celulares',
    slug: 'telefonia-y-celulares',
    parent_id: null,
    is_active: true,
    verticals: ['cellphones'],
    aliases: ['Smartphones', 'Móviles'],
  },
  {
    id: 'cat-2',
    name: 'Accesorios para Celulares',
    slug: 'accesorios-para-celulares',
    parent_id: 'cat-1',
    is_active: true,
    verticals: ['cellphones'],
    aliases: ['Fundas y cargadores'],
  },
  {
    id: 'cat-3',
    name: 'Indumentaria y Calzado',
    slug: 'indumentaria-y-calzado',
    parent_id: null,
    is_active: true,
    verticals: ['clothing'],
    aliases: ['Ropa', 'Moda'],
  },
  {
    id: 'cat-4',
    name: 'Accesorios de Moda',
    slug: 'accesorios-de-moda',
    parent_id: 'cat-3',
    is_active: true,
    verticals: ['clothing'],
    aliases: ['Cinturones y bolsos'],
  },
  {
    id: 'cat-5',
    name: 'Computación y Notebooks',
    slug: 'computacion-y-notebooks',
    parent_id: null,
    is_active: true,
    verticals: ['technology'],
    aliases: ['PC y Laptops', 'Laptops'],
  },
  {
    id: 'cat-6',
    name: 'Televisores',
    slug: 'televisores',
    parent_id: null,
    is_active: true,
    aliases: ['Smart TV', 'TV'],
  },
  {
    id: 'cat-7',
    name: 'Memorias RAM',
    slug: 'memorias-ram',
    parent_id: 'cat-5',
    is_active: true,
    aliases: ['RAM'],
  },
]

describe('Category Sync Assistant - Motor Puro', () => {
  it('normaliza tildes, signos, mayúsculas y espacios', () => {
    expect(normalizeCategoryText('¡CÉLULARES & ACCESORIOS!   ')).toBe('celulares accesorios')
    expect(normalizeCategoryText('Telefonía Móvil')).toBe('telefonia movil')
  })

  it('singulariza palabras frecuentes en español', () => {
    expect(singularizeWord('celulares')).toBe('celular')
    expect(singularizeWord('luces')).toBe('luz')
    expect(singularizeWord('pendrives')).toBe('pendrive')
  })

  it('extrae y ordena tokens significativos excluyendo stopwords', () => {
    const tokens = extractSignificantTokens('Accesorios para Celulares de Moda')
    expect(tokens).toEqual(['accesorio', 'celular', 'moda'])
  })

  it('reconoce coincidencia exacta con alta confianza', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Telefonía y Celulares',
      count: 5,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.bestMatch?.targetId).toBe('cat-1')
    expect(result.confidence).toBe('alta')
    expect(result.reasons).toContain('Mismo nombre normalizado')
  })

  it('reconoce alias configurados con alta confianza', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Smartphones',
      count: 2,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.bestMatch?.targetId).toBe('cat-1')
    expect(result.confidence).toBe('alta')
    expect(result.reasons.some((r) => r.includes('alias'))).toBe(true)
  })

  it('detecta palabras clave reordenadas ("celulares accesorios" vs "accesorios celulares")', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Celulares Accesorios',
      count: 1,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.bestMatch?.targetId).toBe('cat-2')
    expect(result.reasons.some((r) => r.includes('Mismos términos clave en distinto orden'))).toBe(true)
  })

  it('detecta errores tipográficos leves en palabras largas sin confundir palabras cortas', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Smartfones', // 1 letra errada de Smartphones (alias de cat-1)
      count: 1,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.bestMatch?.targetId).toBe('cat-1')
    expect(result.confidence).toBe('media')
  })

  it('rechaza tolerancia tipográfica en siglas cortas (evita emparejar "PC" con "TV")', () => {
    const input: UnlinkedCategoryInput = {
      name: 'PC',
      count: 1,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    // PC es alias de Computación y Notebooks, no debe caer en TV
    expect(result.bestMatch?.targetId).toBe('cat-5')
  })

  it('penaliza categorías con conflicto explícito de rubro', () => {
    const inputTech: UnlinkedCategoryInput = {
      name: 'Accesorios',
      vertical: 'clothing', // Tienda de indumentaria
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(inputTech, MOCK_CATALOG, parentMap)

    // Debe preferir Accesorios de Moda antes que Accesorios para Celulares
    expect(result.bestMatch?.targetId).toBe('cat-4')
  })

  it('utiliza la categoría madre (parentName) para desempatar subcategorías homónimas', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Accesorios',
      parentName: 'Telefonía y Celulares',
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.bestMatch?.targetId).toBe('cat-2')
    expect(result.reasons.some((r) => r.includes('madre coincidente'))).toBe(true)
  })

  it('degrada confianza de "alta" a "media" ante candidatos con puntaje cercano (empate o ambigüedad)', () => {
    const inputAmbiguo: UnlinkedCategoryInput = {
      name: 'Accesorios', // Tanto cat-2 como cat-4 contienen 'accesorios'
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(inputAmbiguo, MOCK_CATALOG, parentMap)

    // Nunca debe ser alta debido a la ambigüedad sin contexto de rubro o padre
    expect(result.confidence).not.toBe('alta')
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('devuelve "sin coincidencia" cuando no hay nada remotamente semejante', () => {
    const input: UnlinkedCategoryInput = {
      name: 'Extintores y Mangueras Hidráulicas',
      count: 1,
    }
    const parentMap = new Map(MOCK_CATALOG.map((c) => [c.id, c.name]))
    const result = analyzeSingleCategory(input, MOCK_CATALOG, parentMap)

    expect(result.confidence).toBe('sin coincidencia')
    expect(result.bestMatch).toBeNull()
  })

  it('procesa lotes completos manteniendo estabilidad y orden de resultados', () => {
    const batch: UnlinkedCategoryInput[] = [
      { name: 'Smartphones', count: 3 },
      { name: 'Ropa', count: 1 },
      { name: 'Fundas Celular', count: 2 },
    ]
    const results = analyzeUnlinkedBatch(batch, MOCK_CATALOG)

    expect(results).toHaveLength(3)
    expect(results[0].unlinkedName).toBe('Smartphones')
    expect(results[0].bestMatch?.targetId).toBe('cat-1')
    expect(results[1].unlinkedName).toBe('Ropa')
    expect(results[1].bestMatch?.targetId).toBe('cat-3')
  })

  it('separa nombres iguales cuando pertenecen a rubros o categorías madre diferentes', () => {
    const groups = groupUnlinkedCategoriesByContext([
      { id: '1', name: 'Accesorios', vertical: 'cellphones', parentName: 'Celulares', organizationName: 'Tienda A' },
      { id: '2', name: 'Accesorios', vertical: 'clothing', parentName: 'Moda', organizationName: 'Tienda B' },
      { id: '3', name: 'accesorios', vertical: 'cellphones', parentName: 'Celulares', organizationName: 'Tienda C' },
    ])

    expect(groups).toHaveLength(2)
    expect(groups.find((group) => group.vertical === 'cellphones')?.ids).toEqual(['1', '3'])
    expect(groups.find((group) => group.vertical === 'clothing')?.ids).toEqual(['2'])
  })
})
