import { describe, expect, it } from 'vitest'
import {
  EMPTY_LANDING_FILTERS,
  LANDING_PRESETS,
  countActiveFilters,
  editedBucket,
  isPresetActive,
  landingFacetCounts,
  landingRowsToCsv,
  matchesLandingFilters,
  parseLandingFilters,
  presetFilters,
  serializeLandingFilters,
  toggleInList,
} from './landing-filters'
import { assessLanding, normalizeHeroTitle } from './landing-readiness'
import type { StoreCommerce } from './landing-commerce'

const NOW = new Date('2026-09-16T12:00:00Z').getTime()
const hace = (dias: number) => new Date(NOW - dias * 86_400_000).toISOString()
const PLANTILLA = new Set([normalizeHeroTitle('Los mejores productos al mejor precio')])

type Opciones = { publica?: boolean; productos?: number; logo?: boolean; marketplace?: boolean; plan?: string; rubro?: string; editada?: string | null }

const tienda = (slug: string, name: string, over: Opciones = {}) => ({
  name,
  slug,
  plan: over.plan ?? 'PRO',
  vertical: over.rubro ?? 'electronics',
  activeProducts: over.productos ?? 10,
  marketplacePublic: over.marketplace ?? true,
  assessment: assessLanding({
    storefrontPublic: over.publica ?? true,
    organizationLogoUrl: over.logo === false ? null : 'https://cdn/logo.png',
    activeProducts: over.productos ?? 10,
    templateHeroTitles: PLANTILLA,
    settings: [
      { key: 'company_info', value: { whatsapp: '0981', address: 'x', instagram: '@x' }, updated_at: over.editada === undefined ? hace(2) : over.editada },
      { key: 'hero_content', value: { title: `Hola ${slug}` }, updated_at: null },
      { key: 'promotional_carousel', value: { enabled: true, slides: [{ active: true, imageUrl: 'https://cdn/1.jpg' }] }, updated_at: null },
    ],
  }),
})

const ventas = (sold: number): StoreCommerce => ({
  sold, previousSold: 0, counterSales: sold > 0 ? 1 : 0, counterRevenue: sold, onlineOrders: 0, onlineRevenue: 0, visitors: null, views: null, conversion: null,
})

const filas = [
  tienda('lista', 'Lista'),
  tienda('sin-logo', 'Sin Logo', { logo: false, plan: 'FREE', editada: hace(60) }),
  tienda('sin-productos', 'Sin Productos', { productos: 0, logo: false, rubro: 'clothing' }),
  tienda('raices', 'Raíces y Diseños', { publica: false, marketplace: false, plan: 'free', editada: null }),
]
const ventasDe = (row: { slug: string }) => (row.slug === 'lista' || row.slug === 'sin-logo' ? ventas(100_000) : ventas(0))
const filtrar = (filtros: typeof EMPTY_LANDING_FILTERS) =>
  filas.filter((row) => matchesLandingFilters(row, filtros, ventasDe(row), NOW)).map((row) => row.slug)

describe('filtros de la lista de tiendas', () => {
  it('lee y escribe la dirección, e ignora lo que no reconoce', () => {
    const filtros = parseLandingFilters({
      estado: 'incomplete,raro,incomplete', falta: 'logo,nada', ventas: 'con', vitrina: 'no', q: ' hca ',
      plan: 'pro,<script>', rubro: 'clothing,Mal Rubro', editada: 'vieja',
    })
    expect(filtros).toEqual({
      q: ' hca ', statuses: ['incomplete'], missing: ['logo'], sales: 'with', visibility: 'hidden',
      plans: ['PRO'], verticals: ['clothing'], edited: 'stale',
    })
    expect(serializeLandingFilters(filtros)).toEqual({
      q: 'hca', estado: 'incomplete', falta: 'logo', ventas: 'con', vitrina: 'no', plan: 'PRO', rubro: 'clothing', editada: 'vieja',
    })
    expect(serializeLandingFilters(EMPTY_LANDING_FILTERS)).toEqual({})
    expect(parseLandingFilters({})).toEqual(EMPTY_LANDING_FILTERS)
  })

  /** Antes había un filtro a la vez: no se podía pedir «incompletas sin logo que venden». */
  it('combina grupos: todos tienen que cumplirse', () => {
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, statuses: ['incomplete'], missing: ['logo'], sales: 'with' })).toEqual(['sin-logo'])
  })

  it('dentro de un grupo alcanza con una opción', () => {
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, missing: ['products', 'published'] })).toEqual(['sin-productos', 'raices'])
  })

  it('la búsqueda no distingue tildes ni mayúsculas', () => {
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, q: 'RAICES' })).toEqual(['raices'])
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, q: 'diseno' })).toEqual(['raices'])
  })

  it('filtra por plan, sin importar cómo esté escrito, y por rubro', () => {
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, plans: ['FREE'] })).toEqual(['sin-logo', 'raices'])
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, verticals: ['clothing'] })).toEqual(['sin-productos'])
  })

  it('filtra por cuándo se editó la página', () => {
    expect(editedBucket(hace(3), NOW)).toBe('recent')
    expect(editedBucket(hace(45), NOW)).toBe('stale')
    expect(editedBucket(null, NOW)).toBe('never')
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, edited: 'stale' })).toEqual(['sin-logo'])
    expect(filtrar({ ...EMPTY_LANDING_FILTERS, edited: 'never' })).toEqual(['raices'])
  })

  it('cuenta cada opción respetando los otros grupos, no el propio', () => {
    const counts = landingFacetCounts(filas, { ...EMPTY_LANDING_FILTERS, statuses: ['incomplete'] }, ventasDe, NOW)
    expect(counts.statuses).toEqual({ ready: 1, incomplete: 2, hidden: 1, maintenance: 0 })
    expect(counts.missing.logo).toBe(2)
    expect(counts.sales).toEqual({ with: 1, without: 1 })
    // Un plan que existe aparece aunque con los filtros quede en cero.
    expect(counts.plans).toEqual({ PRO: 1, FREE: 1 })
    expect(counts.verticals).toEqual({ electronics: 1, clothing: 1 })
  })

  it('cuenta los filtros activos y agrega o saca opciones', () => {
    expect(countActiveFilters({ ...EMPTY_LANDING_FILTERS, q: 'x', statuses: ['ready'], missing: ['logo', 'hero'], sales: 'without', plans: ['PRO'], edited: 'never' })).toBe(7)
    expect(toggleInList(['ready'], 'hidden')).toEqual(['ready', 'hidden'])
    expect(toggleInList(['ready', 'hidden'], 'ready')).toEqual(['hidden'])
  })
})

describe('vistas rápidas', () => {
  const vista = (id: string) => LANDING_PRESETS.find((preset) => preset.id === id)!

  it('cada una arma sus filtros desde cero', () => {
    expect(presetFilters(vista('venden-incompletas'))).toEqual({ ...EMPTY_LANDING_FILTERS, statuses: ['incomplete'], sales: 'with' })
    expect(filtrar(presetFilters(vista('venden-incompletas')))).toEqual(['sin-logo'])
    expect(filtrar(presetFilters(vista('sin-productos')))).toEqual(['sin-productos'])
  })

  it('se marca solo si los filtros son exactamente los suyos', () => {
    const filtros = presetFilters(vista('no-publicadas'))
    expect(isPresetActive(filtros, vista('no-publicadas'))).toBe(true)
    expect(isPresetActive({ ...filtros, q: 'x' }, vista('no-publicadas'))).toBe(false)
  })
})

describe('exportar la lista', () => {
  it('arma un CSV para Excel con lo que se ve', () => {
    const csv = landingRowsToCsv(filas.slice(0, 2), ventasDe, (status) => (status === 'ready' ? 'Lista' : 'Incompleta'))
    expect(csv.startsWith('﻿Tienda;Dirección;Estado;')).toBe(true)
    const [, primera, segunda] = csv.split('\r\n')
    expect(primera).toBe('Lista;/lista;Lista;8/8;;PRO;Tecnología y celulares;Sí;10;100000;1;0;;;2026-09-14')
    expect(segunda.split(';').slice(0, 5)).toEqual(['Sin Logo', '/sin-logo', 'Incompleta', '7/8', 'Logo'])
  })

  it('escapa lo que rompería las columnas', () => {
    const rara = { ...tienda('rara', 'Tienda "La; Nueva"'), activeProducts: null }
    expect(landingRowsToCsv([rara], () => null, () => 'Lista').split('\r\n')[1].startsWith('"Tienda ""La; Nueva"""')).toBe(true)
  })
})
