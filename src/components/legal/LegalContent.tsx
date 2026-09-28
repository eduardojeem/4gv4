import { Fragment, type ReactNode } from 'react'

/**
 * Renderiza el texto de un documento legal con un formato mínimo:
 *   ## Título / ### Subtítulo, párrafos, listas con "- " y **negrita**.
 *
 * Todo se convierte en elementos React (nunca HTML crudo), así que el
 * contenido guardado en la base no puede inyectar scripts.
 */
export function LegalContent({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/)

  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      {blocks.map((block, index) => renderBlock(block.trim(), index))}
    </div>
  )
}

function renderBlock(block: string, key: number): ReactNode {
  if (!block) return null

  if (block.startsWith('### ')) {
    return (
      <h3 key={key} className="pt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
        {inline(block.slice(4))}
      </h3>
    )
  }
  if (block.startsWith('## ')) {
    return (
      <h2 key={key} className="pt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {inline(block.slice(3))}
      </h2>
    )
  }

  const lines = block.split('\n')
  if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    return (
      <ul key={key} className="list-disc space-y-1.5 pl-6">
        {lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>)}
      </ul>
    )
  }

  return (
    <p key={key}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(line)}
        </Fragment>
      ))}
    </p>
  )
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  )
}
