import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Vive aparte porque la pagina del marketplace tiene cambios sin commitear de
 * otra rama de trabajo: esta prueba se suma cuando esa pagina se commitee.
 */
describe('el marketplace muestra el aviso', () => {
  it('lo pide en el servidor y lo monta al entrar', () => {
    const page = leer('src/app/marketplace/page.tsx')
    expect(page).toContain('getPlatformAnnouncement()')
    expect(page).toContain('<AnnouncementModal announcement={announcement} scope="marketplace" />')
  })
})
