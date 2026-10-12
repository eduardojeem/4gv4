import { describe, expect, it } from 'vitest'
import {
  AirVent, Briefcase, Cable, Cctv, CookingPot, Cpu, Headphones, House, Keyboard, Monitor, Mouse, Package,
  Plug, Printer, Refrigerator, Router, Shirt, Smartphone, Sparkles, Speaker, SprayCan, Sprout,
  UtensilsCrossed, Watch, WashingMachine, Waves,
} from 'lucide-react'
import { categoryVisual, normalizeCategoryKey } from '@/lib/public/category-taxonomy'

/**
 * Las 31 categorías publicadas en el marketplace (octubre 2026), tal como las
 * escribió cada tienda. Antes compartían 4 iconos y varias caían en la rama
 * equivocada: «LAVARROPA» en Moda, «Accesorios de belleza» en Tecnología,
 * «Perfumes» y «HELADERAS» en Otros.
 */
const REALES: Array<[string, string, unknown]> = [
  ['accesorios', 'tecnologia', Plug],
  ['Accesorios de belleza', 'belleza', Sparkles],
  ['Accesorios de Celular', 'tecnologia', Smartphone],
  ['audio', 'tecnologia', Speaker],
  ['Audio y Video', 'tecnologia', Speaker],
  ['auriculares', 'tecnologia', Headphones],
  ['Cargadores y Cables', 'tecnologia', Cable],
  ['CCTV', 'tecnologia', Cctv],
  ['Celulares', 'tecnologia', Smartphone],
  ['CESPED', 'hogar', Sprout],
  ['Climatizacion', 'hogar', AirVent],
  ['COSINA', 'hogar', CookingPot],
  ['Electrodomesticos', 'hogar', Plug],
  ['Electrodomésticos', 'hogar', Plug],
  ['Electrónica', 'tecnologia', Cpu],
  ['Estetica', 'belleza', Sparkles],
  ['Estética', 'belleza', Sparkles],
  ['HELADERAS', 'hogar', Refrigerator],
  ['HOGAR', 'hogar', House],
  ['Impresoras', 'tecnologia', Printer],
  ['LAVARROPA', 'hogar', WashingMachine],
  ['Línea Corporativa & Empresas', 'moda', Briefcase],
  ['MOUSE', 'tecnologia', Mouse],
  ['Pantallas LCD/OLED', 'tecnologia', Monitor],
  ['Perfumes', 'belleza', SprayCan],
  ['PILETAS', 'hogar', Waves],
  ['RED E INTERNET', 'tecnologia', Router],
  ['RELOJ', 'moda', Watch],
  ['Remeras Básicas', 'moda', Shirt],
  ['TECLADOS', 'tecnologia', Keyboard],
  ['UTENSILIO', 'hogar', UtensilsCrossed],
]

describe('las categorías reales del marketplace', () => {
  it.each(REALES)('%s → rama %s, con su icono', (nombre, rama, icono) => {
    const visual = categoryVisual(nombre)
    expect(visual.branch).toBe(rama)
    expect(visual.icon).toBe(icono)
  })

  it('ninguna cae en «Otros» con el icono genérico', () => {
    expect(REALES.filter(([nombre]) => !categoryVisual(nombre).matched).map(([nombre]) => nombre)).toEqual([])
  })

  it('tienen iconos variados, no 4 para todas', () => {
    expect(new Set(REALES.map(([nombre]) => categoryVisual(nombre).icon)).size).toBeGreaterThanOrEqual(20)
  })
})

describe('el reconocimiento por palabra', () => {
  it('«ropa» no reconoce «lavarropa», pero «heladera» reconoce «heladeras»', () => {
    expect(categoryVisual('Lavarropas automáticos').branch).toBe('hogar')
    expect(categoryVisual('Ropa de bebé').icon).toBe(Shirt)
  })

  it('no confunde palabras que empiezan igual', () => {
    expect(categoryVisual('Casacas').icon).not.toBe(House)
    expect(categoryVisual('Portones automáticos').branch).not.toBe('ferreteria')
    expect(categoryVisual('Reductores').icon).not.toBe(Router)
  })

  it('lo desconocido va a «Otros» con un paquete', () => {
    expect(categoryVisual('Zzz varios')).toEqual({ icon: Package, branch: 'servicios', matched: false })
  })

  it('normaliza tildes, mayúsculas y «&»', () => {
    expect(normalizeCategoryKey('  LÍNEA Corporativa & Empresas ')).toBe('linea corporativa y empresas')
  })
})
