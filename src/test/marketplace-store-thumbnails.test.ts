import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

// Con el cupo de optimización de imágenes de Vercel agotado, toda foto que pasa
// por /_next/image responde 402 y en el celular (otro ancho, sin caché) no se ve.
describe('miniaturas de productos en el directorio de empresas', () => {
  it.each([
    'src/components/public/OrganizationDirectoryCard.tsx',
    'src/components/public/OrganizationDetailModal.tsx',
  ])('%s usa AppImage, que no reoptimiza las fotos ya optimizadas al subirlas', (path) => {
    const source = read(path)
    expect(source).not.toContain("from 'next/image'")
    expect(source).toContain('<AppImage')
  })
})
