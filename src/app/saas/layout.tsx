import { SaaSMobileBottomNav } from '@/components/public/SaaSMobileBottomNav'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { getPlatformBranding } from '@/lib/platform/branding'

export default async function SaaSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const branding = await getPlatformBranding()

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-16 lg:pb-0">
        {children}
        <footer className="border-t bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} {branding.platformName}
            </p>
            <LegalFooterLinks />
          </div>
        </footer>
      </div>
      <SaaSMobileBottomNav />
    </div>
  )
}
