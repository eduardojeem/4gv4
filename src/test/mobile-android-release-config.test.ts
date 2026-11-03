import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const app = JSON.parse(readFileSync(resolve(process.cwd(), 'mobile/app.json'), 'utf8')).expo

/** Avisos de Play Console: ofuscación DEX del 1 % y orientación bloqueada en pantallas grandes. */
describe('configuración del build de Android', () => {
  it('los builds de producción pasan por R8 (minify y recursos)', () => {
    const plugin = app.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-build-properties')
    expect(plugin?.[1]?.android).toMatchObject({ enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true })
  })

  it('no bloquea la orientación: Android 16 la ignora en tablets y plegables', () => {
    expect(app.orientation).toBe('default')
  })
})
