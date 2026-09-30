import { Fragment, type ReactNode } from 'react'

/**
 * Renderiza el texto de un documento legal con un formato mínimo:
 *   # / ## Título, ### Subtítulo, párrafos, listas con "- " y **negrita**.
 *
 * Se lee línea por línea: un título es siempre una sola línea. Antes se
 * separaba solo por líneas en blanco, y un "## 1. Objeto" seguido de su
 * párrafo sin línea en blanco convertía todo el párrafo en título; un "# "
 * se mostraba tal cual.
 *
 * Todo se convierte en elementos React (nunca HTML crudo), así que el
 * contenido guardado en la base no puede inyectar scripts.
 */

export type LegalHeading = { id: string; text: string }

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'p'; lines: string[] }

const LIST_ITEM = /^\s*[-*]\s+/
/** La página ya muestra la fecha de vigencia de la versión publicada. */
const LAST_UPDATED = /^\*{0,2}\s*última actualización\s*:?/i

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*/g, '')
}

function slugify(value: string) {
  return normalizedText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion'
}

function parse(content: string, title?: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', lines: paragraph })
    if (list.length) blocks.push({ kind: 'ul', items: list })
    paragraph = []
    list = []
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n')
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return flush()

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      const [, marks, text] = heading
      // El título ya lo pone la página: un "# Título" igual al del documento no se repite.
      if (marks.length === 1 && title && normalizedText(text) === normalizedText(title)) return
      blocks.push({ kind: marks.length === 3 ? 'h3' : 'h2', text })
      return
    }

    // "Última actualización: 2026" al principio repite la fecha de la versión.
    if (blocks.length === 0 && paragraph.length === 0 && index < 4 && LAST_UPDATED.test(line)) return

    if (LIST_ITEM.test(line)) {
      if (paragraph.length) { blocks.push({ kind: 'p', lines: paragraph }); paragraph = [] }
      list.push(line.replace(LIST_ITEM, ''))
      return
    }
    if (list.length) { blocks.push({ kind: 'ul', items: list }); list = [] }
    paragraph.push(line)
  })
  flush()
  return blocks
}

/** Títulos de sección con su ancla, para el índice de la página. */
export function legalHeadings(content: string, title?: string): LegalHeading[] {
  const used = new Map<string, number>()
  return parse(content, title)
    .filter((block): block is { kind: 'h2'; text: string } => block.kind === 'h2')
    .map((block) => {
      const base = slugify(block.text)
      const count = used.get(base) ?? 0
      used.set(base, count + 1)
      return { id: count ? `${base}-${count + 1}` : base, text: block.text.replace(/\*\*/g, '') }
    })
}

export function LegalContent({ content, title }: { content: string; title?: string }) {
  const blocks = parse(content, title)
  const headingIds = legalHeadings(content, title).map((heading) => heading.id)
  let h2Index = 0

  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      {blocks.map((block, key) => {
        if (block.kind === 'h2') {
          const id = headingIds[h2Index++]
          return (
            <h2 key={key} id={id} className="scroll-mt-24 pt-6 text-xl font-bold tracking-tight text-slate-900 first:pt-0 dark:text-slate-50">
              {inline(block.text)}
            </h2>
          )
        }
        if (block.kind === 'h3') {
          return (
            <h3 key={key} className="pt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {inline(block.text)}
            </h3>
          )
        }
        if (block.kind === 'ul') {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-6 marker:text-slate-400">
              {block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}
            </ul>
          )
        }
        return (
          <p key={key}>
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  )
}
