/**
 * El rubro de un comercio, en palabras, para mostrarlo al público.
 *
 * En las tarjetas públicas este lugar lo ocupaba el plan contratado —«LITE»,
 * «PRO+», «ENTERPRISE»—, que le decía a cualquier visitante cuánto paga cada
 * comercio. No es asunto suyo y además no le sirve: quien mira el directorio
 * busca a qué se dedica el negocio, no qué le factura la plataforma.
 *
 * `rubro` ya viene resuelto por `resolveOrganizationRubro`, que lo toma del
 * `business_vertical` de la tienda o lo infiere de las categorías de sus
 * productos.
 */

const ETIQUETAS: Record<string, string> = {
  tecnologia: 'Tecnología',
  ferreteria: 'Ferretería',
  indumentaria: 'Moda & Retail',
  automotor: 'Automotor',
  alimentos: 'Alimentos',
  belleza: 'Belleza',
  hogar: 'Hogar',
  salud: 'Salud',
  comercio: 'Comercio',
}

export function rubroLabel(rubro?: string | null): string | null {
  const clave = (rubro || '').toLowerCase().trim()
  if (!clave) return null

  const conocido = Object.keys(ETIQUETAS).find((id) => clave.includes(id))
  if (conocido) return ETIQUETAS[conocido]

  // Un rubro sin etiqueta propia se muestra igual, con su nombre: es mejor que
  // esconder el dato que la tienda cargó.
  return clave.charAt(0).toUpperCase() + clave.slice(1)
}
