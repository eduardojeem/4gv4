import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONFIG = readFileSync(resolve(process.cwd(), '.storybook/main.ts'), 'utf8')
const INTRODUCTION = readFileSync(resolve(process.cwd(), 'src/stories/Introduction.mdx'), 'utf8')
const PRODUCT_ANALYTICS_STORY = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/products/stats/ProductAnalyticsDashboard.stories.tsx'),
  'utf8',
)
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}

describe('Configuración portable de Storybook', () => {
  it('deja la copia de recursos públicos únicamente a Storybook', () => {
    expect(CONFIG).toContain('publicDir: false')
    expect(CONFIG).toContain('copyPublicDir: false')
    expect(CONFIG).toContain('viteFinal:')
  })
  it('usa una ruta de recursos estáticos válida en Windows y Linux', () => {
    expect(CONFIG).toContain('"../public"')
    expect(CONFIG).not.toContain('"..\\\\public"')
  })

  it('excluye la guía inicial que rompe el adaptador de imágenes en Windows', () => {
    expect(CONFIG).toContain('"../src/stories/Introduction.mdx"')
    expect(CONFIG).not.toContain('"../src/**/*.mdx"')
  })

  it('importa los bloques MDX desde el paquete disponible en Storybook 9', () => {
    expect(INTRODUCTION).toContain("from '@storybook/addon-docs/blocks'")
    expect(INTRODUCTION).not.toContain("from '@storybook/blocks'")
  })

  it('usa la API de acciones incluida en Storybook 9', () => {
    expect(PRODUCT_ANALYTICS_STORY).toContain("from 'storybook/actions'")
    expect(PRODUCT_ANALYTICS_STORY).not.toContain("from '@storybook/addon-actions'")
  })

  it('ejecuta una prueba existente en el control de Storybook', () => {
    expect(PACKAGE_JSON.scripts?.['test:storybook']).toBe('vitest run src/test/storybook-config.test.ts')
  })
})
