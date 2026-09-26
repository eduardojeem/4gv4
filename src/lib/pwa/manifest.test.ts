import { describe, expect, it } from 'vitest'

import { buildWebManifest, toShortName } from './manifest'

describe('buildWebManifest', () => {
  const base = {
    id: '/x?app=tienda',
    name: 'Tienda',
    shortName: 'Tienda',
    description: 'desc',
    startUrl: '/mi-tienda/inicio',
    scope: '/mi-tienda',
  }

  it('mantiene la tienda dentro de su propio alcance', () => {
    const manifest = buildWebManifest(base)

    // Es la garantia que arregla el multi-tenant: sin este scope, el icono
    // instalado desde una tienda abria la raiz de la plataforma.
    expect(manifest.scope).toBe('/mi-tienda')
    expect(manifest.start_url).toBe('/mi-tienda/inicio')
    expect(manifest.start_url.startsWith(manifest.scope as string)).toBe(true)
  })

  it('declara iconos maskable ademas de los normales', () => {
    const purposes = (buildWebManifest(base).icons ?? []).map((icon) => icon.purpose)

    // Sin un maskable propio Android encierra el icono en un cuadrado blanco.
    expect(purposes).toContain('maskable')
    expect(purposes).toContain('any')
  })

  it('declara los dos tamanos que exigen los navegadores para instalar', () => {
    const sizes = (buildWebManifest(base).icons ?? [])
      .filter((icon) => icon.purpose === 'any')
      .map((icon) => icon.sizes)

    expect(sizes).toEqual(['192x192', '512x512'])
  })

  it('se puede instalar en modo app', () => {
    expect(buildWebManifest(base).display).toBe('standalone')
  })
})

describe('toShortName', () => {
  it('deja intacto un nombre que ya entra', () => {
    expect(toShortName('Tienda')).toBe('Tienda')
  })

  it('recorta el nombre largo que el launcher truncaria igual', () => {
    expect(toShortName('Electronica y Servicios del Este')).toBe('Electronica')
  })
})
