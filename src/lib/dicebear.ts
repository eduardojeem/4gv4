/**
 * DiceBear Avatar Service
 * Genera avatares únicos usando la API de DiceBear
 */

export type DiceBearStyle = 
  | 'adventurer'
  | 'adventurer-neutral'
  | 'avataaars'
  | 'avataaars-neutral'
  | 'big-ears'
  | 'big-ears-neutral'
  | 'big-smile'
  | 'bottts'
  | 'bottts-neutral'
  | 'croodles'
  | 'croodles-neutral'
  | 'fun-emoji'
  | 'icons'
  | 'identicon'
  | 'initials'
  | 'lorelei'
  | 'lorelei-neutral'
  | 'micah'
  | 'miniavs'
  | 'notionists'
  | 'notionists-neutral'
  | 'open-peeps'
  | 'personas'
  | 'pixel-art'
  | 'pixel-art-neutral'
  | 'rings'
  | 'shapes'
  | 'thumbs'

export interface DiceBearOptions {
  style?: DiceBearStyle
  seed?: string
  size?: number
  backgroundColor?: string[]
  radius?: number
  scale?: number
  flip?: boolean
  rotate?: number
  translateX?: number
  translateY?: number
}

export interface AvatarVariant {
  style: DiceBearStyle
  name: string
  description: string
  category: 'human' | 'abstract' | 'fun' | 'retro'
}

// Estilos disponibles organizados por categoría
export const AVATAR_STYLES: AvatarVariant[] = [
  // Humanos
  {
    style: 'adventurer',
    name: 'Aventurero',
    description: 'Avatares humanos con estilo aventurero',
    category: 'human'
  },
  {
    style: 'adventurer-neutral',
    name: 'Aventurero Neutral',
    description: 'Versión neutral del estilo aventurero',
    category: 'human'
  },
  {
    style: 'avataaars',
    name: 'Avataaars',
    description: 'Estilo popular inspirado en Sketch',
    category: 'human'
  },
  {
    style: 'avataaars-neutral',
    name: 'Avataaars Neutral',
    description: 'Versión neutral de Avataaars',
    category: 'human'
  },
  {
    style: 'big-ears',
    name: 'Orejas Grandes',
    description: 'Personajes con orejas prominentes',
    category: 'human'
  },
  {
    style: 'big-ears-neutral',
    name: 'Orejas Grandes Neutral',
    description: 'Versión neutral de orejas grandes',
    category: 'human'
  },
  {
    style: 'lorelei',
    name: 'Lorelei',
    description: 'Avatares femeninos elegantes',
    category: 'human'
  },
  {
    style: 'lorelei-neutral',
    name: 'Lorelei Neutral',
    description: 'Versión neutral de Lorelei',
    category: 'human'
  },
  {
    style: 'micah',
    name: 'Micah',
    description: 'Estilo minimalista y moderno',
    category: 'human'
  },
  {
    style: 'open-peeps',
    name: 'Open Peeps',
    description: 'Ilustraciones de personas diversas',
    category: 'human'
  },
  {
    style: 'personas',
    name: 'Personas',
    description: 'Avatares realistas de personas',
    category: 'human'
  },
  
  // Divertidos
  {
    style: 'big-smile',
    name: 'Gran Sonrisa',
    description: 'Caras sonrientes y alegres',
    category: 'fun'
  },
  {
    style: 'bottts',
    name: 'Robots',
    description: 'Robots coloridos y únicos',
    category: 'fun'
  },
  {
    style: 'bottts-neutral',
    name: 'Robots Neutral',
    description: 'Robots en tonos neutros',
    category: 'fun'
  },
  {
    style: 'croodles',
    name: 'Croodles',
    description: 'Doodles creativos y únicos',
    category: 'fun'
  },
  {
    style: 'croodles-neutral',
    name: 'Croodles Neutral',
    description: 'Doodles en tonos neutros',
    category: 'fun'
  },
  {
    style: 'fun-emoji',
    name: 'Emoji Divertido',
    description: 'Emojis coloridos y expresivos',
    category: 'fun'
  },
  {
    style: 'miniavs',
    name: 'Mini Avatares',
    description: 'Avatares pequeños y lindos',
    category: 'fun'
  },
  {
    style: 'notionists',
    name: 'Notionists',
    description: 'Estilo inspirado en Notion',
    category: 'fun'
  },
  {
    style: 'notionists-neutral',
    name: 'Notionists Neutral',
    description: 'Notionists en tonos neutros',
    category: 'fun'
  },
  {
    style: 'thumbs',
    name: 'Pulgares',
    description: 'Avatares con pulgares arriba',
    category: 'fun'
  },

  // Abstractos
  {
    style: 'icons',
    name: 'Iconos',
    description: 'Iconos simples y limpios',
    category: 'abstract'
  },
  {
    style: 'identicon',
    name: 'Identicon',
    description: 'Patrones geométricos únicos',
    category: 'abstract'
  },
  {
    style: 'initials',
    name: 'Iniciales',
    description: 'Avatares basados en iniciales',
    category: 'abstract'
  },
  {
    style: 'rings',
    name: 'Anillos',
    description: 'Patrones de anillos coloridos',
    category: 'abstract'
  },
  {
    style: 'shapes',
    name: 'Formas',
    description: 'Formas geométricas abstractas',
    category: 'abstract'
  },

  // Retro
  {
    style: 'pixel-art',
    name: 'Pixel Art',
    description: 'Avatares estilo 8-bit',
    category: 'retro'
  },
  {
    style: 'pixel-art-neutral',
    name: 'Pixel Art Neutral',
    description: 'Pixel art en tonos neutros',
    category: 'retro'
  }
]

// Colores de fondo predefinidos
export const BACKGROUND_COLORS = [
  ['transparent'],
  ['#f3f4f6'], // gray-100
  ['#ddd6fe'], // purple-200
  ['#bfdbfe'], // blue-200
  ['#bbf7d0'], // green-200
  ['#fed7aa'], // orange-200
  ['#fecaca'], // red-200
  ['#fde68a'], // yellow-200
  ['#f9a8d4'], // pink-200
  ['#c7d2fe'], // indigo-200
]

/**
 * Genera una URL de avatar de DiceBear
 */
export function generateDiceBearAvatar(
  seed: string,
  options: DiceBearOptions = {}
): string {
  const {
    style = 'avataaars',
    size = 200,
    backgroundColor = ['transparent'],
    radius = 0,
    scale = 100,
    flip = false,
    rotate = 0,
    translateX = 0,
    translateY = 0
  } = options

  const baseUrl = 'https://api.dicebear.com/7.x'
  const params = new URLSearchParams()

  // Parámetros básicos
  params.set('seed', seed)
  params.set('size', size.toString())
  
  // Parámetros de estilo
  if (backgroundColor.length > 0 && backgroundColor[0] !== 'transparent') {
    params.set('backgroundColor', backgroundColor.join(','))
  }
  
  if (radius > 0) {
    params.set('radius', radius.toString())
  }
  
  if (scale !== 100) {
    params.set('scale', scale.toString())
  }
  
  if (flip) {
    params.set('flip', 'true')
  }
  
  if (rotate !== 0) {
    params.set('rotate', rotate.toString())
  }
  
  if (translateX !== 0) {
    params.set('translateX', translateX.toString())
  }
  
  if (translateY !== 0) {
    params.set('translateY', translateY.toString())
  }

  return `${baseUrl}/${style}/svg?${params.toString()}`
}

/**
 * Genera múltiples variantes de avatar para un usuario
 */
export function generateAvatarVariants(
  seed: string,
  count: number = 6,
  options: Partial<DiceBearOptions> = {}
): Array<{ url: string; style: DiceBearStyle; name: string }> {
  // Seleccionar estilos diversos
  const selectedStyles = [
    'avataaars',
    'adventurer',
    'big-smile',
    'bottts',
    'lorelei',
    'micah',
    'pixel-art',
    'croodles'
  ].slice(0, count) as DiceBearStyle[]

  return selectedStyles.map(style => {
    const styleInfo = AVATAR_STYLES.find(s => s.style === style)
    return {
      url: generateDiceBearAvatar(seed, { ...options, style }),
      style,
      name: styleInfo?.name || style
    }
  })
}

/**
 * Genera un seed único basado en información del usuario
 */
export function generateUserSeed(
  userId: string,
  email?: string,
  name?: string
): string {
  // Combinar información disponible para crear un seed único
  const components = [userId]
  
  if (email) {
    components.push(email.toLowerCase())
  }
  
  if (name) {
    components.push(name.toLowerCase().replace(/\s+/g, ''))
  }
  
  return components.join('-')
}

/**
 * Obtiene el avatar por defecto para un usuario
 */
export function getDefaultAvatar(
  userId: string,
  email?: string,
  name?: string,
  style: DiceBearStyle = 'avataaars'
): string {
  const seed = generateUserSeed(userId, email, name)
  return generateDiceBearAvatar(seed, {
    style,
    size: 200,
    backgroundColor: ['transparent'],
    radius: 50 // Bordes redondeados
  })
}

/**
 * Verifica si una URL es un avatar de DiceBear
 */
export function isDiceBearAvatar(url: string): boolean {
  return url.includes('api.dicebear.com') || url.includes('dicebear')
}

/**
 * Extrae el seed de una URL de DiceBear
 */
export function extractSeedFromDiceBearUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('seed')
  } catch {
    return null
  }
}

/**
 * Genera un avatar con fallback
 */
export function getAvatarWithFallback(
  customAvatarUrl?: string | null,
  userId?: string,
  email?: string,
  name?: string,
  style: DiceBearStyle = 'avataaars'
): string {
  // Si hay avatar personalizado, usarlo
  if (customAvatarUrl && customAvatarUrl.trim() !== '') {
    return customAvatarUrl
  }
  
  // Si no hay userId, usar avatar genérico
  if (!userId) {
    return generateDiceBearAvatar('anonymous', { style })
  }
  
  // Generar avatar por defecto
  return getDefaultAvatar(userId, email, name, style)
}