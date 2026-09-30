import { createAdminSupabase } from '@/lib/supabase/admin'
import { WebContentHub, type WebContentHubData } from '@/components/superadmin/WebContentHub'
import { getLandingRows } from '@/lib/superadmin/landing-rows'
import { summarizeLandings } from '@/lib/superadmin/landing-readiness'
import { getPlatformBranding, DEFAULT_PLATFORM_BRANDING } from '@/lib/platform/branding'
import { getPlatformAnnouncementsUncached } from '@/lib/platform/announcement'
import { announcementStatus } from '@/lib/announcements/announcement'
import { listLegalDocuments, LEGAL_DOCUMENT_TYPES, responsibleDataGaps } from '@/lib/legal/documents'

export const revalidate = 60

/** Tiendas publicadas en el marketplace y sus productos, contados por Postgres. */
async function getMarketplaceSummary() {
  const admin = createAdminSupabase()
  const [{ data: orgs, error }, { data: counts }] = await Promise.all([
    admin.from('organizations').select('id, storefront_public, marketplace_public'),
    (admin as unknown as {
      from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{ organization_id: string; products: number | string }> | null }> }
    }).from('org_catalog_counts').select('organization_id, products'),
  ])
  if (error) return null
  const visible = new Set(
    ((orgs ?? []) as Array<{ id: string; storefront_public: boolean | null; marketplace_public: boolean | null }>)
      .filter((org) => org.storefront_public === true && org.marketplace_public === true)
      .map((org) => org.id),
  )
  const products = counts
    ? counts.filter((row) => visible.has(row.organization_id)).reduce((sum, row) => sum + (Number(row.products) || 0), 0)
    : null
  return { visibleStores: visible.size, totalStores: orgs?.length ?? 0, products }
}

async function getHubData(): Promise<WebContentHubData> {
  const now = new Date()
  const [landing, branding, announcements, legal, marketplace] = await Promise.all([
    getLandingRows(),
    getPlatformBranding(),
    getPlatformAnnouncementsUncached(),
    listLegalDocuments(),
    getMarketplaceSummary(),
  ])

  const statuses = announcements.map((announcement) => announcementStatus(announcement, now))

  return {
    landings: landing.failed ? null : summarizeLandings(landing.rows.map((row) => row.assessment)),
    brand: {
      platformName: branding.platformName,
      hasLogo: Boolean(branding.logoUrl),
      hasFavicon: Boolean(branding.faviconUrl),
      isDefaultName: branding.platformName === DEFAULT_PLATFORM_BRANDING.platformName,
      hasSeoDescription: branding.seoDescription !== DEFAULT_PLATFORM_BRANDING.seoDescription,
    },
    announcements: {
      total: announcements.length,
      live: statuses.filter((status) => status === 'activo').length,
      scheduled: statuses.filter((status) => status === 'programado').length,
    },
    legal: 'reason' in legal
      ? null
      : LEGAL_DOCUMENT_TYPES.map((type) => {
        const versions = legal.documents.filter((document) => document.documentType === type)
        const published = versions.find((document) => document.status === 'published') ?? null
        return {
          type,
          publishedVersion: published?.version ?? null,
          hasDraft: versions.some((document) => document.status === 'draft'),
          responsibleGaps: published ? responsibleDataGaps(published.content) : [],
        }
      }),
    marketplace,
  }
}

export default async function SuperAdminWebContentPage() {
  const data = await getHubData()
  return <WebContentHub data={data} />
}
