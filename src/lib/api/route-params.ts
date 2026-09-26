/**
 * El parámetro de una ruta dinámica, resuelto.
 *
 * En Next 16 el segundo argumento de un handler trae `params` como **promesa**.
 * Varias rutas lo leían como si fuera un objeto (`context.params?.id`), y eso
 * devuelve `undefined` siempre: el handler cortaba con «Falta el sorteo» y un
 * 400 antes de tocar la base. Así estuvieron publicar un sorteo, ver sus
 * participantes, canjear números, sortear y activar una regla de puntos.
 *
 * Acepta las dos formas —promesa u objeto— porque el mismo helper sirve para
 * las rutas viejas y para los tests, que pasan el objeto directo.
 */

type ParamsLike = Record<string, string | string[] | undefined>

export async function routeParam(routeContext: unknown, key: string): Promise<string | null> {
  const params = (routeContext as { params?: ParamsLike | Promise<ParamsLike> } | undefined)?.params
  if (!params) return null

  const resueltos = await Promise.resolve(params)
  const valor = resueltos?.[key]

  if (typeof valor === 'string') return valor || null
  // Una ruta atrapa-todo (`[...slug]`) devuelve un arreglo; acá sirve el primero.
  if (Array.isArray(valor)) return valor[0] ?? null
  return null
}
