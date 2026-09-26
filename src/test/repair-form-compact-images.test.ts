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

  it('los consejos se pueden reemplazar', () => {
    // Los de fabrica hablan de productos —«la primera imagen sera la principal
    // del producto»— y en una reparacion eso no aplica.
    expect(UPLOADER).toContain('const listaDeConsejos = tips ?? CONSEJOS_POR_DEFECTO')
    expect(UPLOADER).toContain("{tipsTitle ?? 'Consejos para mejores imágenes:'}")
  })

  it('en compacto los consejos son una linea, no una tarjeta', () => {
    // El bloque se repite por equipo y aparece justo cuando el formulario esta
    // vacio, que es cuando mas estorba. El resto queda en el `title`.
    const bloque = UPLOADER.slice(UPLOADER.indexOf('{images.length === 0 && listaDeConsejos.length > 0'))
    // El `\n` va escapado: se busca el texto del código, no un salto real.
    expect(bloque.slice(0, 700)).toMatch(/title=\{listaDeConsejos\.join\('\\n'\)\}/)
    expect(bloque.slice(0, 700)).toContain('{listaDeConsejos[0]}')
  })

  it('reparaciones habla del estado de ingreso, no del producto', () => {
    expect(FORMULARIO).toContain('CONSEJOS_FOTOS_INGRESO')
    expect(FORMULARIO).toContain('Fotografiá los golpes y rayaduras que ya tiene')
    expect(FORMULARIO).toContain('Fotos del estado con el que entró:')
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
