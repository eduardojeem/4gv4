import { SaaSMobileBottomNav } from '@/components/public/SaaSMobileBottomNav'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { getPlatformBranding } from '@/lib/platform/branding'
import { buildSupportContact, formatSupportWhatsapp, supportWhatsappLink } from '@/lib/platform/support-contact'

// Branding and child-page metadata need server credentials at request time, not in CI builds.
// Their data helpers retain the shared cache independently of page rendering.
export const dynamic = 'force-dynamic'

export default async function SaaSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const branding = await getPlatformBranding()
  const support = buildSupportContact(branding)
  const whatsappUrl = supportWhatsappLink(support.whatsapp, 'Hola, quiero hacer una consulta.')

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-16 lg:pb-0">
        {children}
        <footer className="border-t bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                © {new Date().getFullYear()} {branding.platformName}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400" data-support-contact>
                <span className="font-medium text-slate-700 dark:text-slate-300">Soporte:</span>
                <a className="underline-offset-4 hover:text-primary hover:underline" href={`mailto:${support.email}`}>{support.email}</a>
                {whatsappUrl && (
                  <a className="underline-offset-4 hover:text-primary hover:underline" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    WhatsApp {formatSupportWhatsapp(support.whatsapp)}
                  </a>
                )}
                {support.hours && <span>{support.hours}</span>}
              </p>
            </div>
            <LegalFooterLinks />
          </div>
        </footer>
      </div>
      <SaaSMobileBottomNav />
    </div>
  )
}
