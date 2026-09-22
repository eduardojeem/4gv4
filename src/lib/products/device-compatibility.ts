/**
 * Para qué celular es un repuesto.
 *
 * Un repuesto tiene tres datos que el catálogo mezclaba en dos campos:
 *
 * - la **marca del celular** al que pertenece (Apple, Samsung),
 * - el **modelo del celular** (iPhone 13, A15), que es por lo que se busca y
 *   se ordena en un local de reparación,
 * - la **marca del repuesto** (AmpSentrix, Aftermarket XO7), que es el campo
 *   `brand` de siempre.
 *
 * En 4G celulares, «pantalla a12» tenía marca Samsung y «OLED Assembly For
 * iPhone 13» tenía marca «Aftermarket Plus: Soft 3.0»: el mismo campo decía a
 * veces para qué teléfono era y a veces quién fabricó la pieza. Y el modelo
 * sólo vivía dentro del nombre, escrito cada vez distinto («iphone 13»,
 * «Iphone 12 pro max», «Sansung A05»), así que no había forma de agruparlos.
 *
 * Esto normaliza marca y modelo para que el mismo teléfono se escriba siempre
 * igual. Es lo que hace posible ordenar y filtrar.
 */

/** Marcas de celulares tal como se escriben. La clave va en minúsculas. */
const MARCAS_CONOCIDAS: Record<string, string> = {
  apple: 'Apple',
  samsung: 'Samsung',
  xiaomi: 'Xiaomi',
  motorola: 'Motorola',
  huawei: 'Huawei',
  honor: 'Honor',
  oppo: 'Oppo',
  realme: 'Realme',
  tecno: 'Tecno',
  infinix: 'Infinix',
  zte: 'ZTE',
  nokia: 'Nokia',
  lg: 'LG',
  google: 'Google',
  oneplus: 'OnePlus',
  vivo: 'Vivo',
  alcatel: 'Alcatel',
  itel: 'Itel',
  blu: 'BLU',
  sony: 'Sony',
}

/**
 * Cómo aparecen escritas en el catálogo real. «iphone» como marca es Apple, y
 * Redmi y Poco son submarcas de Xiaomi: el cliente del mostrador las busca
 * juntas.
 */
const ALIAS_DE_MARCA: Record<string, string> = {
  sansung: 'Samsung',
  samsumg: 'Samsung',
  samgung: 'Samsung',
  iphone: 'Apple',
  redmi: 'Xiaomi',
  poco: 'Xiaomi',
  moto: 'Motorola',
}

/** Palabras que dentro de un modelo tienen una forma fija. */
const PALABRAS_DE_MODELO: Record<string, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  galaxy: 'Galaxy',
  pro: 'Pro',
  max: 'Max',
  plus: 'Plus',
  mini: 'Mini',
  ultra: 'Ultra',
  lite: 'Lite',
  note: 'Note',
  edge: 'Edge',
  play: 'Play',
  power: 'Power',
  fold: 'Fold',
  flip: 'Flip',
  se: 'SE',
  fe: 'FE',
  xr: 'XR',
  xs: 'XS',
  redmi: 'Redmi',
  poco: 'Poco',
}

export const MAX_MODELOS_POR_PRODUCTO = 20
export const MAX_LARGO_DE_NOMBRE = 60

const espacios = (valor: string) => valor.replace(/\s+/g, ' ').trim()

const capitalizada = (palabra: string) =>
  palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : palabra

/** «sansung» → «Samsung», «APPLE» → «Apple», una desconocida con mayúscula inicial. */
export function normalizeDeviceBrand(entrada: string | null | undefined): string | null {
  const limpia = espacios(entrada ?? '').slice(0, MAX_LARGO_DE_NOMBRE)
  if (!limpia) return null

  const clave = limpia.toLowerCase()
  if (ALIAS_DE_MARCA[clave]) return ALIAS_DE_MARCA[clave]
  if (MARCAS_CONOCIDAS[clave]) return MARCAS_CONOCIDAS[clave]

  // «Huawei/Honor» y similares: cada parte por separado.
  return limpia
    .split(/(\s+|\/)/)
    .map((parte) => (/^\s+$|^\/$/.test(parte) ? parte : MARCAS_CONOCIDAS[parte.toLowerCase()] ?? capitalizada(parte)))
    .join('')
}

/**
 * «iphone 13 pro max» → «iPhone 13 Pro Max», «a15» → «A15», «x7b» → «X7B».
 *
 * No agrega ni saca palabras: si el local escribe «A15» no se convierte en
 * «Galaxy A15». Sólo unifica cómo se escribe cada una, que es lo que hace que
 * dos cargas del mismo modelo terminen juntas.
 */
export function normalizeDeviceModel(entrada: string | null | undefined): string | null {
  const limpia = espacios(entrada ?? '').slice(0, MAX_LARGO_DE_NOMBRE)
  if (!limpia) return null

  return limpia
    .split(' ')
    .map((palabra) => {
      const clave = palabra.toLowerCase()
      if (PALABRAS_DE_MODELO[clave]) return PALABRAS_DE_MODELO[clave]
      // Letra(s) + número (+ letra): códigos de modelo, en mayúsculas: A15, X7B, G84, S23.
      if (/^[a-z]{1,2}\d+[a-z]{0,2}$/i.test(palabra)) return palabra.toUpperCase()
      // Números sueltos o con letra final: 13, 12s → 12S.
      if (/^\d+[a-z]{0,2}$/i.test(palabra)) return palabra.toUpperCase()
      return capitalizada(palabra)
    })
    .join(' ')
}

/**
 * La lista de modelos compatibles, normalizada: sin vacíos y sin repetidos
 * aunque estén escritos distinto. Una pantalla «For iPhone 12 / 12 Pro» sirve
 * para dos modelos, por eso es una lista.
 */
export function normalizeDeviceModels(entrada: ReadonlyArray<string | null | undefined> | null | undefined): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []

  for (const valor of entrada ?? []) {
    const modelo = normalizeDeviceModel(valor)
    if (!modelo) continue
    const clave = modelo.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(modelo)
    if (salida.length >= MAX_MODELOS_POR_PRODUCTO) break
  }

  return salida
}

/** «Apple · iPhone 13, 13 Pro». Null si no hay nada que decir. */
export function describeDeviceCompatibility(
  marca: string | null | undefined,
  modelos: ReadonlyArray<string> | null | undefined,
): string | null {
  const lista = (modelos ?? []).filter(Boolean)
  if (!marca && lista.length === 0) return null
  if (!lista.length) return marca ?? null
  return marca ? `${marca} · ${lista.join(', ')}` : lista.join(', ')
}

/**
 * Clave para ordenar por celular: marca y primer modelo, con los números
 * rellenados para que «iPhone 8» vaya antes que «iPhone 11» y no después.
 * Los productos sin celular cargado van al final.
 */
export function deviceSortKey(marca: string | null | undefined, modelos: ReadonlyArray<string> | null | undefined): string {
  const primero = (modelos ?? [])[0]
  if (!marca && !primero) return '￿'
  const texto = `${marca ?? ''} ${primero ?? ''}`.toLowerCase().trim()
  return texto.replace(/\d+/g, (numero) => numero.padStart(6, '0'))
}

/**
 * Quién ve estos campos: los negocios de tecnología y los talleres de
 * celulares. A una tienda de ropa o de muebles «¿para qué celular es?» no le
 * dice nada, y «marca del repuesto» no tiene sentido para una remera.
 *
 * Se decide con el perfil que la organización declaró: rubro `electronics` o
 * modelo de operación `repair` (un taller, aunque su rubro diga otra cosa).
 */
export function usesDeviceCompatibility({
  businessVertical,
  operatingModel,
}: {
  businessVertical?: string | null
  operatingModel?: string | null
}): boolean {
  return businessVertical === 'electronics' || operatingModel === 'repair'
}
