import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Play Console: «Quita las restricciones de redimensionamiento y orientación».
// La única venía del escáner de ML Kit que trae expo-camera (fijo en vertical).
// Se prueba el cambio puro del manifiesto: el CI no instala las dependencias de la app.
const require = createRequire(resolve(process.cwd(), 'mobile/package.json'))

describe('pantallas grandes', () => {
  it('quita la orientación fija del escáner de ML Kit', () => {
    const { removeScannerOrientation, SCANNER_ACTIVITY } = require('./plugins/large-screen-scanner-manifest.js')
    const manifest = { manifest: { $: {}, application: [{ activity: [{ $: { 'android:name': SCANNER_ACTIVITY, 'android:screenOrientation': 'PORTRAIT' } }] }] } }
    const result = removeScannerOrientation(manifest)
    const activity = result.manifest.application[0].activity[0].$
    expect(activity['android:screenOrientation']).toBeUndefined()
    expect(activity['tools:remove']).toBe('android:screenOrientation')
    expect(result.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools')
  })

  it('si la librería no declara la actividad, igual la deja sin orientación fija', () => {
    const { removeScannerOrientation, SCANNER_ACTIVITY } = require('./plugins/large-screen-scanner-manifest.js')
    const result = removeScannerOrientation({ manifest: { $: {}, application: [{}] } })
    expect(result.manifest.application[0].activity[0].$).toEqual({ 'android:name': SCANNER_ACTIVITY, 'tools:remove': 'android:screenOrientation' })
  })

  it('el plugin usa ese cambio y app.config.js lo registra', () => {
    expect(readFileSync(resolve(process.cwd(), 'mobile/plugins/with-large-screen-scanner.js'), 'utf8')).toContain('removeScannerOrientation(cfg.modResults)')
    const appConfig = require('./app.config.js')
    const config = appConfig({ config: { name: 'x', slug: 'x', plugins: ['expo-router'] } })
    expect(config.plugins).toEqual(['expo-router', './plugins/with-large-screen-scanner'])
  })
})
