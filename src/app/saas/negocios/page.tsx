import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo/page-metadata'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessPageContent } from '@/components/saas/landing/saas-business-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { getPlatformBranding } from '@/lib/platform/branding'
import { getMarketplaceOrganizations } from '@/lib/public/marketplace'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return publicPageMetadata({
    title: `Negocios y Comercios Adheridos | ${branding.platformName}`,
    description: 'Conocé las tiendas, importadoras y talleres técnicos que impulsan sus ventas y operaciones con nuestra plataforma.',
    path: '/saas/negocios',
  })
}

export default async function SaaSBusinessPage() {
  const [branding, organizations] = await Promise.all([
    getPlatformBranding(),
    getMarketplaceOrganizations(24).catch(() => []),
  ])

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSBusinessPageContent initialOrganizations={organizations} />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}
