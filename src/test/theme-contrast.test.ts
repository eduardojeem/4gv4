import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste de los colores de marca, medido sobre el propio CSS.
 *
 * La auditoría encontró texto blanco sobre el azul de marca en 3,5 y el ámbar
 * de una tienda usado como texto en 1,55 —prácticamente invisible—, cuando el
 * mínimo para leer es 4,5. Y el modo oscuro de la tienda nunca se aplicaba.
 */

const CSS = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

/** Mínimo de la WCAG para texto normal. */
const AA = 4.5

// ── oklch → sRGB, para poder medir lo que declara el CSS ────────────────────
function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const lineal = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)))

  return lineal as [number, number, number]
}

/** Luminancia relativa: la que usa la fórmula de contraste. */
function luminancia(lineal: [number, number, number]): number {
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2]
}

function contraste(a: string, b: string): number {
  const L1 = luminancia(parseOklch(a))
  const L2 = luminancia(parseOklch(b))
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

function parseOklch(valor: string): [number, number, number] {
  const m = valor.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/)
  if (!m) throw new Error(`No se pudo leer el color: ${valor}`)
  return oklchToRgb(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** El bloque de un selector, tal cual está escrito en el CSS. */
function bloque(selector: string): string {
  const inicio = CSS.indexOf(selector + ' {')
  if (inicio === -1) throw new Error(`No existe el bloque ${selector}`)
  const fin = CSS.indexOf('}', inicio)
  return CSS.slice(inicio, fin)
}

function token(texto: string, nombre: string): string | null {
  const m = texto.match(new RegExp(`--${nombre}:\\s*([^;]+);`))
  return m ? m[1].trim() : null
}

const ESQUEMAS = [
  'corporate', 'blue', 'green', 'purple', 'orange', 'red', 'indigo',
  'teal', 'pink', 'amber', 'cyan', 'rose', 'emerald', 'sky',
]

describe('la conversión de color que usa esta prueba', () => {
  /** Comprobado contra lo que pinta el navegador: oklch(0.53 0.2 240) → rgb(0,114,209). */
  it('coincide con lo que mide el navegador', () => {
    const [r, g, b] = parseOklch('oklch(0.53 0.2 240)').map((v) =>
      Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255),
    )
    expect(Math.abs(r - 0)).toBeLessThanOrEqual(6)
    expect(Math.abs(g - 114)).toBeLessThanOrEqual(6)
    expect(Math.abs(b - 209)).toBeLessThanOrEqual(6)
  })
})

describe('el texto sobre el color de marca se lee', () => {
  const foregroundClaro = token(bloque(':root'), 'primary-foreground')!

  it.each(ESQUEMAS)('en claro, el esquema %s llega a 4,5', (esquema) => {
    const texto = bloque(`[data-color-scheme="${esquema}"]`)
    const primary = token(texto, 'primary')!
    const fg = token(texto, 'primary-foreground') ?? foregroundClaro
    expect(contraste(primary, fg), `${esquema}: ${primary} sobre ${fg}`).toBeGreaterThanOrEqual(AA)
  })

  /**
   * En oscuro el color de marca se aclara para separarse del fondo, así que el
   * texto encima tiene que ir oscuro: blanco sobre ese azul daba 2,6.
   */
  it.each(ESQUEMAS)('en oscuro, el esquema %s llega a 4,5', (esquema) => {
    const texto = bloque(`.dark [data-color-scheme="${esquema}"],\n[data-color-scheme="${esquema}"].dark`)
    const primary = token(texto, 'primary')!
    const fg = token(texto, 'primary-foreground')
    expect(fg, `${esquema} en oscuro no declara el color del texto`).not.toBeNull()
    expect(contraste(primary, fg!), `${esquema}: ${primary} sobre ${fg}`).toBeGreaterThanOrEqual(AA)
  })
})

describe('el modo oscuro alcanza a la tienda pública', () => {
  /**
   * La tienda pone `data-color-scheme` en su contenedor y `.dark` vive en
   * <html>: con `[data-color-scheme="x"].dark` —el mismo elemento— la regla no
   * se aplicaba nunca y la tienda quedaba con el color de marca del modo claro.
   */
  it.each(ESQUEMAS)('el esquema %s también se aplica como descendiente', (esquema) => {
    expect(CSS).toContain(`.dark [data-color-scheme="${esquema}"]`)
  })

  it('el color de marca propio ya se aclaraba, y se mantiene', () => {
    expect(CSS).toContain('.dark [data-custom-brand]')
  })
})

describe('el color de marca como texto', () => {
  /** Como fondo de botón el ámbar va tal cual; como texto hay que oscurecerlo. */
  it('hay un token aparte para el texto, con la luminosidad acotada', () => {
    expect(CSS).toContain('--primary-text: oklch(from var(--primary) clamp(0.2, l, 0.52) c h)')
    expect(CSS).toContain('--primary-text: oklch(from var(--primary) clamp(0.74, l, 0.95) c h)')
    // Si el navegador no entiende `oklch(from ...)`, queda el color de antes.
    expect(CSS).toContain('--primary-text: var(--primary);')
  })

  it('`text-primary` usa esa versión legible', () => {
    expect(CSS).toMatch(/html \.text-primary \{\s*color: var\(--primary-text\);/)
  })
})

describe('el rojo de «sin stock»', () => {
  /** `--destructive-foreground` se usaba en 17 lugares y no estaba definido. */
  it('el token del texto sobre rojo existe y está mapeado', () => {
    expect(token(bloque(':root'), 'destructive-foreground')).not.toBeNull()
    expect(token(bloque('.dark'), 'destructive-foreground')).not.toBeNull()
    expect(CSS).toContain('--color-destructive-foreground: var(--destructive-foreground)')
  })

  it('la insignia no depende del tema: rojo fijo con texto blanco', () => {
    const tarjeta = readFileSync(resolve(process.cwd(), 'src/components/public/ProductCard.tsx'), 'utf8')
    expect(tarjeta).toContain('bg-red-700/95 text-white')
    expect(tarjeta).not.toContain('bg-destructive/90 text-destructive-foreground')
  })
})

/**
 * Marketplace y /saas: medido en el navegador, el marketplace tenia 79 textos
 * por debajo del minimo en claro y 45 en oscuro; /saas, 2 y 6. Ahora son 0 en
 * los cuatro casos. Estas comprobaciones fijan los tonos que lo resolvieron.
 */
describe('marketplace y saas', () => {
  const marketplace = readFileSync(resolve(process.cwd(), 'src/app/marketplace/page.tsx'), 'utf8')
  const grilla = readFileSync(resolve(process.cwd(), 'src/components/public/MarketplaceOrgProductGrid.tsx'), 'utf8')
  const barra = readFileSync(resolve(process.cwd(), 'src/components/public/CompactCategoryBar.tsx'), 'utf8')
  const buscador = readFileSync(resolve(process.cwd(), 'src/components/public/MarketplaceSearchBox.tsx'), 'utf8')

  /**
   * Era un boton `outline` sobre fondo claro: pintaba su fondo blanco y el
   * texto blanco encima. Desde 16b7d482 vive en el modal de acceso, asi que
   * lo que se comprueba es ahi: texto oscuro sobre claro, y su propio par
   * para el modo oscuro.
   */
  it('«Ver planes» no queda blanco sobre blanco', () => {
    const modal = readFileSync(resolve(process.cwd(), 'src/components/public/AuthModal.tsx'), 'utf8')
    const boton = modal.slice(modal.indexOf("onNavigate('/saas')"), modal.indexOf('Ver planes'))
    expect(boton).toContain('text-slate-600')
    expect(boton).toContain('dark:text-slate-300')
    expect(boton).not.toContain('text-white')
    // Y no quedo una copia olvidada en la portada del marketplace.
    expect(marketplace).not.toContain('border-white/40 text-white hover:bg-white/10')
  })

  it('la etiqueta OFERTA y los datos de contacto tienen tono legible', () => {
    expect(grilla).toContain('bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white')
    expect(grilla).toContain('text-emerald-700 hover:underline')
    expect(grilla).toContain('text-pink-700 hover:text-pink-800')
  })

  it('la barra de categorías: píldora activa, contador y «Ver todas»', () => {
    expect(barra).toContain('border-cyan-700 bg-cyan-700 text-white')
    expect(barra).toContain('bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')
    expect(barra).not.toContain('text-slate-400 transition-colors')
  })

  /** El color del boton es fijo; el del texto salia del tema y en oscuro se oscurecia. */
  it('el botón de buscar lleva su texto explícito', () => {
    expect(buscador).toContain("'shrink-0 bg-cyan-700 text-white hover:bg-cyan-800'")
  })

  it('en /saas, las etiquetas del panel no dependen del gris apagado', () => {
    const planes = readFileSync(resolve(process.cwd(), 'src/components/saas/landing/saas-plans-section.tsx'), 'utf8')
    expect(planes).toContain('text-[10px] text-slate-600 dark:text-slate-300')
    const hero = readFileSync(resolve(process.cwd(), 'src/components/saas/landing/saas-hero-section.tsx'), 'utf8')
    expect(hero).toContain('px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300')
  })
})
