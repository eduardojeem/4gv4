import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La descripción de un diálogo de Radix se renderiza como `<p>`, y un `<p>` no
 * puede contener otro: React corta con un error de hidratación en cuanto se
 * abre el diálogo. Pasó en el cartel de confirmación del sorteo, que metía dos
 * párrafos adentro.
 *
 * La salida es `asChild` con un `<div>`: queda HTML válido y la descripción
 * sigue siendo la que anuncia `aria-describedby`.
 */

const CARPETAS = ['src/components/dashboard', 'src/app/dashboard']

const archivos: string[] = []
const recorrer = (dir: string) => {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (entrada.endsWith('.tsx')) archivos.push(ruta)
  }
}
for (const carpeta of CARPETAS) recorrer(resolve(process.cwd(), carpeta))

/** `<XDescription ...> ... </XDescription>`, con lo que tenga adentro. */
const BLOQUE = /<(AlertDialog|Dialog|Sheet|Drawer)Description\b([^>]*)>([\s\S]*?)<\/\1Description>/g
/** Etiquetas que el navegador no deja anidar dentro de un párrafo. */
const DE_BLOQUE = /<(p|div|ul|ol|section|h[1-6])\b/

describe('las descripciones de diálogo no anidan bloques dentro de un párrafo', () => {
  it('encuentra pantallas para revisar', () => {
    expect(archivos.length).toBeGreaterThan(50)
  })

  it('ninguna mete un bloque adentro sin usar asChild', () => {
    const culpables: string[] = []

    for (const archivo of archivos) {
      const codigo = readFileSync(archivo, 'utf8')
      for (const encontrado of codigo.matchAll(BLOQUE)) {
        const [, componente, props, cuerpo] = encontrado
        if (/\basChild\b/.test(props)) continue
        const bloque = cuerpo.match(DE_BLOQUE)
        if (!bloque) continue
        const linea = codigo.slice(0, encontrado.index).split('\n').length
        culpables.push(`${archivo}:${linea} — <${bloque[1]}> dentro de ${componente}Description`)
      }
    }

    expect(culpables).toEqual([])
  })

  it('el cartel de confirmar el sorteo usa asChild', () => {
    const manager = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/loyalty/RafflesManager.tsx'),
      'utf8',
    )
    expect(manager).toContain('<AlertDialogDescription asChild')
  })
})
