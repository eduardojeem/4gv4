import type { MetadataRoute } from 'next'

/**
 * Un mismo origen sirve tres apps instalables distintas, porque tienen publicos
 * y puntos de entrada distintos:
 *
 * - comerciante  -> abre en /dashboard, alcance total (necesita admin y POS)
 * - marketplace  -> abre en /marketplace, acotado a esa seccion
 * - tienda       -> abre en /<slug>/inicio, acotado a esa tienda
 *
 * El `scope` importa: un link fuera del alcance se abre en el navegador en vez
 * de dentro de la app instalada. Por eso la tienda se limita a su propio slug,
 * asi el cliente que instala "Tienda X" no termina navegando el panel de otra.
 */
export interface WebManifestInput {
  /** Identidad estable de la app instalada. Cambiarla crea una app nueva. */
  id: string
  name: string
  shortName: string
  description: string
  startUrl: string
  scope: string
  themeColor?: string
  backgroundColor?: string
}

const MAX_SHORT_NAME = 12

/** Azul del logo. Tiñe la barra de estado y la pantalla de carga al abrir. */
const BRAND_THEME_COLOR = '#0059bc'

/** Los launchers recortan el nombre corto: mejor acortarlo nosotros. */
export function toShortName(value: string): string {
  const trimmed = value.trim()
  return trimmed.length <= MAX_SHORT_NAME ? trimmed : trimmed.slice(0, MAX_SHORT_NAME).trimEnd()
}

export function buildWebManifest(input: WebManifestInput): MetadataRoute.Manifest {
  return {
    id: input.id,
    name: input.name,
    short_name: toShortName(input.shortName),
    description: input.description,
    start_url: input.startUrl,
    scope: input.scope,
    display: 'standalone',
    orientation: 'portrait-primary',
    // Blanco: es el fondo de los iconos maskable, asi la pantalla de carga y el
    // icono no muestran un salto de color al abrir la app.
    background_color: input.backgroundColor ?? '#ffffff',
    theme_color: input.themeColor ?? BRAND_THEME_COLOR,
    icons: [
      // `any` y `maskable` van separados a proposito: sin un maskable propio,
      // Android dibuja el icono dentro de un cuadrado blanco en vez de adaptarlo
      // a la forma del launcher.
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
