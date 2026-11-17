import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Play Console: «Quita las restricciones de redimensionamiento y orientación».
// La única venía del escáner de ML Kit que trae expo-camera (fijo en vertical).
const require = createRequire(resolve(process.cwd(), 'mobile/package.json'))

describe('pantallas grandes', () => {
  it('el plugin quita la orientación fija del escáner de ML Kit', async () => {
    const plugin = require('./plugins/with-large-screen-scanner.js')
    const manifest = { manifest: { $: {}, application: [{ activity: [{ $: { 'android:name': plugin.SCANNER_ACTIVITY, 'android:screenOrientation': 'PORTRAIT' } }] }] } }
    // withAndroidManifest registra un mod; se ejecuta a mano con el manifiesto de prueba.
    const config = plugin({ name: 'test', slug: 'test', mods: {} })
    const result = await config.mods.android.manifest({ ...config, modResults: manifest, modRequest: { platform: 'android' } })
    const activity = result.modResults.manifest.application[0].activity[0].$
    expect(activity['android:screenOrientation']).toBeUndefined()
    expect(activity['tools:remove']).toBe('android:screenOrientation')
    expect(result.modResults.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools')
  })

  it('app.config.js lo registra', () => {
    const appConfig = require('./app.config.js')
    const config = appConfig({ config: { name: 'x', slug: 'x', plugins: ['expo-router'] } })
    expect(config.plugins).toContain('./plugins/with-large-screen-scanner')
    expect(config.plugins).toContain('expo-router')
  })
})
