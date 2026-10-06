import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('tamaño de letra de accesibilidad', () => {
  // `font-medium`/`font-normal` también son clases de Tailwind (peso de la letra).
  // Sin el `html.` delante, la regla de accesibilidad pisaba `text-xs`/`text-sm`
  // en todo el sitio: cualquier texto seminegrita quedaba en 16 px.
  it.each(['src/styles/accessibility.css', 'src/app/globals.css'])('%s solo aplica los tamaños sobre <html>', (path) => {
    const unscoped = read(path)
      .split('\n')
      .filter((line) => /^\s*\.font-(small|normal|medium|large|extra-large)\b/.test(line))
    expect(unscoped).toEqual([])
  })
})

describe('directorio de empresas', () => {
  it.each(['src/components/public/EmpresasClient.tsx', 'src/app/marketplace/buscar/page.tsx'])(
    '%s muestra dos tarjetas por fila en el celular',
    (path) => {
      expect(read(path)).toContain('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')
    },
  )
})
