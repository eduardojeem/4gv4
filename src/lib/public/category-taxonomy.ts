import type { LucideIcon } from 'lucide-react'
import {
  AirVent, Apple, Baby, Backpack, BookOpen, Briefcase, Cable, Camera, Car, Cctv, Coffee, CookingPot,
  Cpu, Dumbbell, Footprints, Gamepad2, Gem, Glasses, Hammer, HardDrive, Headphones, House, Keyboard,
  Lamp, Laptop, Monitor, Mouse, Music, Package, Palette, PawPrint, PenTool, Pill, Plug, PlugZap,
  Printer, Refrigerator, Router, Scissors, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sofa,
  Sparkles, Speaker, SprayCan, Sprout, Tablet, Tv, UtensilsCrossed, Watch, WashingMachine, Waves,
  Wine, Wrench,
} from 'lucide-react'

/**
 * Icono y rama de cada categoría del marketplace, en un solo lugar.
 *
 * Antes había dos listas: la del catálogo y la portada (palabra → icono) y la
 * de /marketplace/categorias, que metía cada categoría en una de 8 ramas y le
 * ponía el icono de la rama. Con las 31 categorías reales salían 4 iconos en
 * total —14 con el maletín de «Otros»— y varias en la rama equivocada:
 * «LAVARROPA» en Moda (contiene «ropa»), «Accesorios de belleza» en Tecnología
 * (por «accesorios»), «Perfumes» y «HELADERAS» en Otros.
 *
 * Ahora cada término se busca como comienzo de palabra (así «heladera»
 * reconoce «heladeras», pero «ropa» no reconoce «lavarropa»), sin tildes ni
 * mayúsculas, y las reglas van de lo específico a lo general.
 */

export type CategoryBranchId = 'tecnologia' | 'moda' | 'hogar' | 'alimentos' | 'ferreteria' | 'belleza' | 'deportes' | 'servicios'

type Rule = { terms: string[]; icon: LucideIcon; branch: CategoryBranchId }

const RULES: Rule[] = [
  // Frases que contienen palabras de otras ramas: primero.
  { terms: ['accesorios de belleza', 'accesorio de belleza'], icon: Sparkles, branch: 'belleza' },
  { terms: ['accesorios de celular', 'accesorios para celular', 'fundas', 'protector'], icon: Smartphone, branch: 'tecnologia' },
  { terms: ['camara de seguridad', 'camaras de seguridad', 'cctv', 'vigilancia', 'alarma'], icon: Cctv, branch: 'tecnologia' },
  { terms: ['audio y video'], icon: Speaker, branch: 'tecnologia' },
  { terms: ['linea corporativa', 'uniforme'], icon: Briefcase, branch: 'moda' },

  // Belleza y salud
  { terms: ['perfum', 'fragancia'], icon: SprayCan, branch: 'belleza' },
  { terms: ['estetic', 'belleza', 'cosmetic', 'maquilla', 'skincare', 'manicur'], icon: Sparkles, branch: 'belleza' },
  { terms: ['peluquer', 'barber'], icon: Scissors, branch: 'belleza' },
  { terms: ['farmacia', 'salud', 'medicament'], icon: Pill, branch: 'belleza' },
  { terms: ['mascota', 'veterinari'], icon: PawPrint, branch: 'belleza' },

  // Electrodomésticos y hogar (antes que «ropa» y «cocina» genéricos)
  { terms: ['heladera', 'refrigerador', 'freezer', 'congelador'], icon: Refrigerator, branch: 'hogar' },
  { terms: ['lavarropa', 'lavadora', 'secarropa', 'lavavajilla'], icon: WashingMachine, branch: 'hogar' },
  { terms: ['climatiza', 'aire acondicionado', 'aires acondicionados', 'ventilador', 'calefac'], icon: AirVent, branch: 'hogar' },
  { terms: ['electrodomestic'], icon: Plug, branch: 'hogar' },
  { terms: ['cocina', 'cosina'], icon: CookingPot, branch: 'hogar' },
  { terms: ['utensilio', 'bazar', 'vajilla', 'cubierto'], icon: UtensilsCrossed, branch: 'hogar' },
  { terms: ['pileta', 'piscina'], icon: Waves, branch: 'hogar' },
  { terms: ['cesped', 'jardin', 'planta', 'vivero', 'riego'], icon: Sprout, branch: 'hogar' },
  { terms: ['mueble', 'living', 'comedor', 'sofa', 'colchon'], icon: Sofa, branch: 'hogar' },
  { terms: ['iluminacion', 'lampara', 'decoracion'], icon: Lamp, branch: 'hogar' },
  { terms: ['hogar'], icon: House, branch: 'hogar' },

  // Tecnología
  { terms: ['celular', 'smartphone', 'telefon', 'iphone'], icon: Smartphone, branch: 'tecnologia' },
  { terms: ['cargador', 'cable', 'bateria', 'power bank'], icon: Cable, branch: 'tecnologia' },
  { terms: ['auricular', 'audifono'], icon: Headphones, branch: 'tecnologia' },
  { terms: ['audio', 'parlante', 'sonido'], icon: Speaker, branch: 'tecnologia' },
  { terms: ['pantalla', 'display', 'lcd', 'oled', 'monitor'], icon: Monitor, branch: 'tecnologia' },
  { terms: ['mouse'], icon: Mouse, branch: 'tecnologia' },
  { terms: ['teclado'], icon: Keyboard, branch: 'tecnologia' },
  { terms: ['impresora', 'tinta', 'toner'], icon: Printer, branch: 'tecnologia' },
  { terms: ['red e', 'red de', 'redes', 'internet', 'router', 'wifi'], icon: Router, branch: 'tecnologia' },
  { terms: ['computa', 'notebook', 'laptop', 'pc'], icon: Laptop, branch: 'tecnologia' },
  { terms: ['tablet'], icon: Tablet, branch: 'tecnologia' },
  { terms: ['tv', 'televisor', 'smart tv'], icon: Tv, branch: 'tecnologia' },
  { terms: ['gaming', 'gamer', 'videojuego', 'consola'], icon: Gamepad2, branch: 'tecnologia' },
  { terms: ['almacenamiento', 'disco', 'pendrive', 'memoria'], icon: HardDrive, branch: 'tecnologia' },
  { terms: ['electronica', 'tecnologia'], icon: Cpu, branch: 'tecnologia' },
  { terms: ['repuesto'], icon: Wrench, branch: 'tecnologia' },
  // «Accesorios» a secas: en este marketplace son casi siempre de tecnología.
  { terms: ['accesorio'], icon: Plug, branch: 'tecnologia' },

  // Moda
  { terms: ['reloj'], icon: Watch, branch: 'moda' },
  { terms: ['calzado', 'zapat', 'zapatilla', 'sandalia'], icon: Footprints, branch: 'moda' },
  { terms: ['bolso', 'cartera', 'billetera'], icon: ShoppingBag, branch: 'moda' },
  { terms: ['mochila'], icon: Backpack, branch: 'moda' },
  { terms: ['joya', 'joyeria', 'bisuteria', 'anillo', 'collar'], icon: Gem, branch: 'moda' },
  { terms: ['lentes', 'anteojo', 'gafas'], icon: Glasses, branch: 'moda' },
  { terms: ['remera', 'camisa', 'ropa', 'indumentaria', 'vestido', 'pantalon', 'moda', 'buzo', 'campera'], icon: Shirt, branch: 'moda' },

  // Bebés, después de la ropa: «Ropa de bebé» es ropa.
  { terms: ['bebe', 'infantil'], icon: Baby, branch: 'belleza' },

  // Alimentos
  { terms: ['cafe'], icon: Coffee, branch: 'alimentos' },
  { terms: ['vino', 'cerveza', 'bebida', 'licor'], icon: Wine, branch: 'alimentos' },
  { terms: ['fruta', 'verdura'], icon: Apple, branch: 'alimentos' },
  { terms: ['alimento', 'comida', 'almacen', 'supermercado', 'despensa', 'golosina'], icon: ShoppingBasket, branch: 'alimentos' },

  // Herramientas y vehículos
  { terms: ['herramienta', 'ferreteria'], icon: Wrench, branch: 'ferreteria' },
  { terms: ['construccion', 'material'], icon: Hammer, branch: 'ferreteria' },
  { terms: ['pintura'], icon: Palette, branch: 'ferreteria' },
  { terms: ['electricidad', 'electrico'], icon: PlugZap, branch: 'ferreteria' },
  { terms: ['autos', 'automotor', 'autoparte', 'motos', 'neumatico'], icon: Car, branch: 'ferreteria' },

  // Deportes y ocio
  { terms: ['deporte', 'fitness', 'gimnasio', 'pesas'], icon: Dumbbell, branch: 'deportes' },
  { terms: ['juguete'], icon: Gamepad2, branch: 'deportes' },
  { terms: ['musica', 'instrumento'], icon: Music, branch: 'deportes' },
  { terms: ['fotografia', 'camara'], icon: Camera, branch: 'deportes' },
  { terms: ['libro'], icon: BookOpen, branch: 'deportes' },

  // Servicios y librería
  { terms: ['libreria', 'papeleria', 'oficina', 'utiles'], icon: PenTool, branch: 'servicios' },
  { terms: ['servicio'], icon: Briefcase, branch: 'servicios' },
]

/** Minúsculas, sin tildes, «&» como «y» y espacios simples: «LÍNEA  Corporativa & Empresas» → «linea corporativa y empresas». */
export function normalizeCategoryKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

/** El término empieza una palabra: «heladera» encuentra «heladeras»; «ropa», no «lavarropa». */
function startsAWord(key: string, term: string): boolean {
  return ` ${key}`.includes(` ${term}`)
}

export type CategoryVisual = { icon: LucideIcon; branch: CategoryBranchId; matched: boolean }

export function categoryVisual(name: string): CategoryVisual {
  const key = normalizeCategoryKey(name)
  for (const rule of RULES) {
    if (rule.terms.some((term) => startsAWord(key, term))) return { icon: rule.icon, branch: rule.branch, matched: true }
  }
  return { icon: Package, branch: 'servicios', matched: false }
}
