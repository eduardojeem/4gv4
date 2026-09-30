import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { LegalContent, legalHeadings } from '@/components/legal/LegalContent'
import { getPlatformBranding } from '@/lib/platform/branding'
import { OG_IMAGE_PATH } from '@/lib/seo/page-metadata'
import {
  LEGAL_DOCUMENT_META,
  getPublishedLegalDocument,
  type LegalDocumentType,
} from '@/lib/legal/documents'

const DESCRIPTIONS: Record<LegalDocumentType, string> = {
  privacy: 'Qué datos personales tratamos, para qué, por cuánto tiempo y cómo ejercer tus derechos.',
  terms: 'Condiciones de uso de la plataforma, el marketplace y las suscripciones.',
}

export async function legalDocumentMetadata(documentType: LegalDocumentType): Promise<Metadata> {
  const branding = await getPlatformBranding()
  const title = `${LEGAL_DOCUMENT_META[documentType].label} | ${branding.platformName}`
  return {
    title,
    description: DESCRIPTIONS[documentType],
    alternates: { canonical: LEGAL_DOCUMENT_META[documentType].path },
    openGraph: { title, description: DESCRIPTIONS[documentType], type: 'article', images: [OG_IMAGE_PATH] },
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Muestra la versión publicada. Si la base no responde se usa el texto base
 * de `DEFAULT_LEGAL_DOCUMENTS`; si no hay ninguno, 404.
 */
export async function LegalDocumentPage({ documentType }: { documentType: LegalDocumentType }) {
  const document = await getPublishedLegalDocument(documentType)
  if (!document) notFound()

  const other: LegalDocumentType = documentType === 'privacy' ? 'terms' : 'privacy'
  const headings = legalHeadings(document.content, document.title)

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="max-w-3xl border-b pb-6 dark:border-slate-800">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{document.title}</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Versión {document.version} · Vigente desde el {formatDate(document.publishedAt)}
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
          <article className="min-w-0 max-w-3xl">
            <LegalContent content={document.content} title={document.title} />
          </article>

          {headings.length > 2 && (
            <nav aria-label="En este documento" className="order-first lg:order-none">
              <div className="rounded-xl border p-4 text-sm lg:sticky lg:top-24 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">En este documento</p>
                <ol className="mt-3 space-y-1.5">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className="block leading-snug text-slate-600 underline-offset-4 hover:text-primary hover:underline dark:text-slate-300"
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          )}
        </div>

        <p className="mt-12 max-w-3xl border-t pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Ver también:{' '}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href={LEGAL_DOCUMENT_META[other].path}>
            {LEGAL_DOCUMENT_META[other].label}
          </Link>
        </p>
      </main>
    </div>
  )
}
