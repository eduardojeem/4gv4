/**
 * Utilidad de normalización y consolidación inteligente de ciudades
 * Permite que variantes como "encarnacion", "Encarnación", "Encarnación, Paraguay",
 * "Encarnacion - Itapua", etc., se unifiquen en una sola ciudad canónica con formato profesional.
 */

// Diccionario de ciudades reconocidas y sus variantes comunes
const CANONICAL_CITIES: Record<string, { display: string; key: string }> = {
  // Asunción y Gran Asunción
  'asuncion': { display: 'Asunción', key: 'asuncion' },
  'asu': { display: 'Asunción', key: 'asuncion' },
  'capital': { display: 'Asunción', key: 'asuncion' },
  'san lorenzo': { display: 'San Lorenzo', key: 'san-lorenzo' },
  'luque': { display: 'Luque', key: 'luque' },
  'fernando de la mora': { display: 'Fernando de la Mora', key: 'fernando-de-la-mora' },
  'fdo de la mora': { display: 'Fernando de la Mora', key: 'fernando-de-la-mora' },
  'fdo. de la mora': { display: 'Fernando de la Mora', key: 'fernando-de-la-mora' },
  'lambare': { display: 'Lambaré', key: 'lambare' },
  'capiata': { display: 'Capiatá', key: 'capiata' },
  'mariano roque alonso': { display: 'Mariano Roque Alonso', key: 'mariano-roque-alonso' },
  'mra': { display: 'Mariano Roque Alonso', key: 'mariano-roque-alonso' },
  'mariano r alonso': { display: 'Mariano Roque Alonso', key: 'mariano-roque-alonso' },
  'mariano r. alonso': { display: 'Mariano Roque Alonso', key: 'mariano-roque-alonso' },
  'villa elisa': { display: 'Villa Elisa', key: 'villa-elisa' },
  'nemby': { display: 'Ñemby', key: 'nemby' },
  'itaugua': { display: 'Itauguá', key: 'itaugua' },
  'limpio': { display: 'Limpio', key: 'limpio' },
  'san antonio': { display: 'San Antonio', key: 'san-antonio' },
  'ita': { display: 'Itá', key: 'ita' },
  'aregua': { display: 'Areguá', key: 'aregua' },
  'ypacarai': { display: 'Ypacaraí', key: 'ypacarai' },
  'ypakarai': { display: 'Ypacaraí', key: 'ypacarai' },
  'villeta': { display: 'Villeta', key: 'villeta' },
  'guarambare': { display: 'Guarambaré', key: 'guarambare' },
  'ita cora': { display: 'Itá Corá', key: 'ita-cora' },

  // Alto Paraná
  'ciudad del este': { display: 'Ciudad del Este', key: 'ciudad-del-este' },
  'cde': { display: 'Ciudad del Este', key: 'ciudad-del-este' },
  'c.d.e': { display: 'Ciudad del Este', key: 'ciudad-del-este' },
  'c.d.e.': { display: 'Ciudad del Este', key: 'ciudad-del-este' },
  'presidente franco': { display: 'Presidente Franco', key: 'presidente-franco' },
  'pte franco': { display: 'Presidente Franco', key: 'presidente-franco' },
  'pte. franco': { display: 'Presidente Franco', key: 'presidente-franco' },
  'hernandarias': { display: 'Hernandarias', key: 'hernandarias' },
  'minga guazu': { display: 'Minga Guazú', key: 'minga-guazu' },
  'santa rita': { display: 'Santa Rita', key: 'santa-rita' },
  'juan leon mallorquin': { display: 'Juan León Mallorquín', key: 'juan-leon-mallorquin' },
  'santa rosa del monday': { display: 'Santa Rosa del Monday', key: 'santa-rosa-del-monday' },

  // Itapúa
  'encarnacion': { display: 'Encarnación', key: 'encarnacion' },
  'enc': { display: 'Encarnación', key: 'encarnacion' },
  'cambyreta': { display: 'Cambyretá', key: 'cambyreta' },
  'fram': { display: 'Fram', key: 'fram' },
  'colonias unidas': { display: 'Colonias Unidas', key: 'colonias-unidas' },
  'hohenau': { display: 'Hohenau', key: 'hohenau' },
  'obligado': { display: 'Obligado', key: 'obligado' },
  'bella vista': { display: 'Bella Vista', key: 'bella-vista' },
  'coronel bogado': { display: 'Coronel Bogado', key: 'coronel-bogado' },
  'cnel bogado': { display: 'Coronel Bogado', key: 'coronel-bogado' },
  'cnel. bogado': { display: 'Coronel Bogado', key: 'coronel-bogado' },

  // Cordillera & Paraguarí & Guairá & Caaguazú
  'caacupe': { display: 'Caacupé', key: 'caacupe' },
  'san bernardino': { display: 'San Bernardino', key: 'san-bernardino' },
  'san ber': { display: 'San Bernardino', key: 'san-bernardino' },
  'tobati': { display: 'Tobatí', key: 'tobati' },
  'piribebuy': { display: 'Piribebuy', key: 'piribebuy' },
  'eusebio ayala': { display: 'Eusebio Ayala', key: 'eusebio-ayala' },
  'paraguari': { display: 'Paraguarí', key: 'paraguari' },
  'carapegua': { display: 'Carapeguá', key: 'carapegua' },
  'yaguaron': { display: 'Yaguarón', key: 'yaguaron' },
  'quiindy': { display: 'Quiindy', key: 'quiindy' },
  'villarrica': { display: 'Villarrica', key: 'villarrica' },
  'caaguazu': { display: 'Caaguazú', key: 'caaguazu' },
  'coronel oviedo': { display: 'Coronel Oviedo', key: 'coronel-oviedo' },
  'cnel oviedo': { display: 'Coronel Oviedo', key: 'coronel-oviedo' },
  'cnel. oviedo': { display: 'Coronel Oviedo', key: 'coronel-oviedo' },
  'campo 9': { display: 'J. Eulogio Estigarribia (Campo 9)', key: 'campo-9' },
  'dr juan eulogio estigarribia': { display: 'J. Eulogio Estigarribia (Campo 9)', key: 'campo-9' },

  // Misiones & Ñeembucú
  'san ignacio': { display: 'San Ignacio', key: 'san-ignacio' },
  'san juan bautista': { display: 'San Juan Bautista', key: 'san-juan-bautista' },
  'ayolas': { display: 'Ayolas', key: 'ayolas' },
  'santa rosa': { display: 'Santa Rosa Misiones', key: 'santa-rosa-misiones' },
  'pilar': { display: 'Pilar', key: 'pilar' },

  // Concepción, San Pedro & Amambay & Canindeyú
  'concepcion': { display: 'Concepción', key: 'concepcion' },
  'horqueta': { display: 'Horqueta', key: 'horqueta' },
  'san pedro': { display: 'San Pedro', key: 'san-pedro' },
  'san estanislao': { display: 'San Estanislao (Santaní)', key: 'san-estanislao' },
  'santani': { display: 'San Estanislao (Santaní)', key: 'san-estanislao' },
  'santa rosa del aguaray': { display: 'Santa Rosa del Aguaray', key: 'santa-rosa-del-aguaray' },
  'pedro juan caballero': { display: 'Pedro Juan Caballero', key: 'pedro-juan-caballero' },
  'pjc': { display: 'Pedro Juan Caballero', key: 'pedro-juan-caballero' },
  'salto del guaira': { display: 'Salto del Guairá', key: 'salto-del-guaira' },
  'curuguaty': { display: 'Curuguaty', key: 'curuguaty' },

  // Chaco
  'filadelfia': { display: 'Filadelfia', key: 'filadelfia' },
  'loma plata': { display: 'Loma Plata', key: 'loma-plata' },
  'neuland': { display: 'Neuland', key: 'neuland' },
  'villa hayes': { display: 'Villa Hayes', key: 'villa-hayes' },
  'benjamin aceval': { display: 'Benjamín Aceval', key: 'benjamin-aceval' },
}

// Patrones de sufijos, países y departamentos a remover para limpiar el texto
const STRIP_PATTERNS = [
  /,?\s*paraguay\b/gi,
  /,?\s*py\b/gi,
  /-\s*paraguay\b/gi,
  /-\s*py\b/gi,
  /\(paraguay\)/gi,
  /\(py\)/gi,
  /,?\s*dpto\.?\s*itap[uú]a\b/gi,
  /-\s*itap[uú]a\b/gi,
  /,?\s*itap[uú]a\b/gi,
  /,?\s*dpto\.?\s*central\b/gi,
  /-\s*central\b/gi,
  /,?\s*central\b/gi,
  /,?\s*dpto\.?\s*alto\s*paran[aá]\b/gi,
  /-\s*alto\s*paran[aá]\b/gi,
  /,?\s*alto\s*paran[aá]\b/gi,
  /,?\s*dpto\.?\s*caaguaz[uú]\b/gi,
  /-\s*caaguaz[uú]\b/gi,
  /,?\s*caaguaz[uú]\b/gi,
  /,?\s*dpto\.?\s*cordillera\b/gi,
  /-\s*cordillera\b/gi,
  /,?\s*cordillera\b/gi,
  /,?\s*dpto\.?\s*guair[aá]\b/gi,
  /-\s*guair[aá]\b/gi,
  /,?\s*guair[aá]\b/gi,
  /,?\s*dpto\.?\s*amambay\b/gi,
  /-\s*amambay\b/gi,
  /,?\s*amambay\b/gi,
  /,?\s*dpto\.?\s*concepci[oó]n\b/gi,
  /-\s*concepci[oó]n\b/gi,
  /,?\s*concepci[oó]n\b/gi,
  /,?\s*dpto\.?\s*san\s*pedro\b/gi,
  /-\s*san\s*pedro\b/gi,
  /,?\s*san\s*pedro\b/gi,
  /,?\s*dpto\.?\s*misiones\b/gi,
  /-\s*misiones\b/gi,
  /,?\s*misiones\b/gi,
  /,?\s*dpto\.?\s*[nñ]eembuc[uú]\b/gi,
  /-\s*[nñ]eembuc[uú]\b/gi,
  /,?\s*[nñ]eembuc[uú]\b/gi,
  /,?\s*dpto\.?\s*paraguar[ií]\b/gi,
  /-\s*paraguar[ií]\b/gi,
  /,?\s*paraguar[ií]\b/gi,
  /,?\s*dpto\.?\s*canindey[uú]\b/gi,
  /-\s*canindey[uú]\b/gi,
  /,?\s*canindey[uú]\b/gi,
  /,?\s*dpto\.?\s*boquer[oó]n\b/gi,
  /-\s*boquer[oó]n\b/gi,
  /,?\s*boquer[oó]n\b/gi,
  /,?\s*dpto\.?\s*presidente\s*hayes\b/gi,
  /-\s*presidente\s*hayes\b/gi,
  /,?\s*presidente\s*hayes\b/gi,
]

/**
 * Remueve acentos y caracteres diacríticos para comparación
 */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Formatea un string en formato Titular (Title Case)
 */
function toTitleCase(str: string): string {
  const words = str.toLowerCase().split(/\s+/)
  const minorWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'en'])

  return words
    .map((word, index) => {
      if (index > 0 && minorWords.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Limpia y normaliza una ciudad ingresada libremente por una tienda o usuario.
 * @returns { display: string; key: string } o null si no se proporcionó una ciudad válida
 */
export function normalizeCity(rawCity: string | null | undefined): { display: string; key: string } | null {
  if (!rawCity || typeof rawCity !== 'string') return null

  let text = rawCity.trim()
  if (!text || text === '-' || text.toLowerCase() === 'n/a' || text.toLowerCase() === 'null') return null

  // 1. Limpiar sufijos como ", Paraguay", "- Itapua", etc.
  for (const pattern of STRIP_PATTERNS) {
    text = text.replace(pattern, '')
  }

  // 2. Limpiar puntuación sobrante
  text = text.replace(/^[,\s.-]+|[,\s.-]+$/g, '').trim()

  if (!text) return null

  // 3. Normalizar para búsqueda en diccionario
  const searchKey = removeAccents(text)

  // Búsqueda directa en diccionario canónico
  if (CANONICAL_CITIES[searchKey]) {
    return CANONICAL_CITIES[searchKey]
  }

  // 4. Búsqueda por coincidencia de prefijo o inclusión de ciudad canónica
  // (Ej: "encarnacion 4" o "Av. Irrazabal - Encarnacion" -> coincide con "encarnacion")
  for (const [key, meta] of Object.entries(CANONICAL_CITIES)) {
    if (key.length >= 4) {
      // Si la palabra clave aparece como término exacto o delimitado
      const regex = new RegExp(`\\b${key}\\b`, 'i')
      if (regex.test(searchKey)) {
        return meta
      }
    }
  }

  // 5. Fallback: Formatear nombre en Title Case y generar slug seguro
  const display = toTitleCase(text)
  const key = searchKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return { display, key }
}

/**
 * Compara dos ciudades (o cadenas de ciudad) y determina si representan la misma ubicación.
 */
export function areCitiesEqual(
  cityA: string | null | undefined,
  cityB: string | null | undefined
): boolean {
  if (!cityA || !cityB) return false
  if (cityA.toLowerCase().trim() === 'all' && cityB.toLowerCase().trim() === 'all') return true

  const normA = normalizeCity(cityA)
  const normB = normalizeCity(cityB)

  if (!normA || !normB) return false

  return normA.key === normB.key
}
