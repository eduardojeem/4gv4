import type { ShowcaseRubroId, ShowcaseRubroStats } from './category-showcase'

export type ShowcaseSlide = {
  id: ShowcaseRubroId
  eyebrow: string
  title: string
  description: string
  image: string
  searchTerm: string
  /** Resplandor suave del rubro activo sobre el fondo oscuro neutro. */
  glow: string
}

export const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: 'belleza',
    eyebrow: 'BRILLA CON CONFIANZA',
    title: 'Belleza & Estética',
    description: 'Perfumes, cuidado de piel, cabello y belleza.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format',
    searchTerm: 'belleza',
    glow: 'bg-rose-500/20',
  },
  {
    id: 'servicios',
    eyebrow: 'PROFESIONALES DE CONFIANZA',
    title: 'Servicios',
    description: 'Descubrí expertos locales listos para ayudarte.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format',
    searchTerm: 'servicios',
    glow: 'bg-sky-500/20',
  },
  {
    id: 'electronica',
    eyebrow: 'MÁS CONECTADO CADA DÍA',
    title: 'Electrónica',
    description: 'Celulares, pantallas, cámaras y tecnología para todos los días.',
    image: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=80&auto=format',
    searchTerm: 'electronica',
    glow: 'bg-violet-500/20',
  },
  {
    id: 'electrodomesticos',
    eyebrow: 'CONFORT & TECNOLOGÍA EN CASA',
    title: 'Electrodomésticos',
    description: 'Heladeras, lavarropas, climatización y cocina para tu día a día.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80&auto=format',
    searchTerm: 'electrodomesticos',
    glow: 'bg-blue-500/20',
  },
  {
    id: 'muebles',
    eyebrow: 'CONFORT & DISEÑO',
    title: 'Muebles & Hogar',
    description: 'Todo para tu casa, el jardín y la pileta.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format',
    searchTerm: 'muebles',
    glow: 'bg-amber-500/20',
  },
  {
    id: 'computacion',
    eyebrow: 'PRODUCTIVIDAD & EQUIPAMIENTO',
    title: 'Computación',
    description: 'Tintas, teclados, mouse, almacenamiento y redes.',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format',
    searchTerm: 'computacion',
    glow: 'bg-cyan-500/20',
  },
  {
    id: 'audio',
    eyebrow: 'SONIDO DE ALTA FIDELIDAD',
    title: 'Audio & Video',
    description: 'Auriculares, parlantes y sonido envolvente.',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80&auto=format',
    searchTerm: 'audio',
    glow: 'bg-teal-500/20',
  },
  {
    id: 'moda',
    eyebrow: 'TU PROPIO ESTILO',
    title: 'Moda & Relojería',
    description: 'Remeras básicas, indumentaria corporativa y relojes.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format',
    searchTerm: 'reloj',
    glow: 'bg-pink-500/20',
  },
]

export type ShowcaseCard = ShowcaseSlide & { count: number; categoryIds: string[] }

/** Mismo contenido y orden para web y clientes nativos; sin catálogo no se inventan rubros. */
export function buildShowcaseCards(stats: Partial<Record<ShowcaseRubroId, ShowcaseRubroStats>>): ShowcaseCard[] {
 return SHOWCASE_SLIDES.flatMap(slide => {
  const rubro = stats[slide.id]
  return rubro ? [{...slide, count:rubro.count, categoryIds:rubro.categoryIds}] : []
 }).sort((a,b)=>b.count-a.count)
}
