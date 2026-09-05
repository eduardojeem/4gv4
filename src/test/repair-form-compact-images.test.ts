import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const UPLOADER = leer('src/components/dashboard/products/ImageUploader.tsx')
const FORMULARIO = leer('src/components/dashboard/repair-form-dialog-v2.tsx')

/**
 * En la ficha de reparación hay un cargador de fotos por equipo. El dropzone
 * grande —`p-8`, ícono de 48px, tres renglones y dos botones— mide unos 240px;
 * con tres equipos sumaba cerca de 700px y empujaba el resto del formulario
 * fuera de la pantalla.
 */
describe('el cargador de fotos tiene una versión baja', () => {
  it('achica el dropzone', () => {
    expect(UPLOADER).toContain("${compact ? 'p-3' : 'p-8'}")
  })

  it('achica también las miniaturas', () => {
    // La grilla de cuatro columnas cuadradas ocupaba tanto como el dropzone.
    expect(UPLOADER).toContain("'grid grid-cols-4 sm:grid-cols-6 gap-2'")
  })

  it('no pierde la carga por URL', () => {
    // El botón que abre ese panel vive en la versión grande: sin reponerlo,
    // en compacto la función quedaba inalcanzable.
    const bloque = UPLOADER.slice(UPLOADER.indexOf('hasta {maxImages}'))
    expect(bloque.slice(0, 900)).toContain('setShowUrlInput(!showUrlInput)')
  })

  it('el formulario de reparación la usa', () => {
    const bloque = FORMULARIO.slice(FORMULARIO.indexOf('<ImageUploader'))
    expect(bloque.slice(0, 400)).toContain('compact')
  })

  it('no cambia nada donde no se pide', () => {
    // Productos sigue con el cargador grande: ahí hay uno solo por pantalla.
    expect(UPLOADER).toContain('compact = false')
    const productos = leer('src/components/dashboard/product-modal.tsx')
    if (productos.includes('<ImageUploader')) {
      const bloque = productos.slice(productos.indexOf('<ImageUploader'))
      expect(bloque.slice(0, 400)).not.toContain('compact')
    }
  })
})
