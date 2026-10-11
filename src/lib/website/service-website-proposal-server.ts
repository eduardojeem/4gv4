import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { resolveStorefrontCapabilities } from './storefront-capabilities'
import { buildServiceWebsiteProposal, type ServiceWebsiteOptions } from './service-website-proposal'
import type { WebsiteSettings } from '@/types/website-settings'
import { resolvePublicAgenda } from '@/lib/agenda/public-agenda-server'
import type { PublicAgendaInfo } from '@/components/public/inicio/ServicesHome'

export async function prepareServiceWebsiteProposal(organizationId: string, options: ServiceWebsiteOptions) {
  const admin = createAdminSupabase()
  const before = await admin.rpc('service_website_proposal_revision', { p_organization_id: organizationId })
  const snapshot = await admin.rpc('service_website_proposal_snapshot', { p_organization_id: organizationId })
  if (before.error || snapshot.error || !snapshot.data?.organization) throw new Error('PROPOSAL_UNAVAILABLE')
  const plan = await getOrganizationPlanInfo(organizationId)
  const slug = snapshot.data.organization.slug as string | undefined
  const publicAgenda = slug ? await resolvePublicAgenda(slug) : null
  if (publicAgenda && publicAgenda.organization.id !== organizationId) throw new Error('PROPOSAL_UNAVAILABLE')
  const agenda: PublicAgendaInfo | null = publicAgenda ? {
    currency: publicAgenda.config.currency,
    services: publicAgenda.config.services.filter(service => service.online).map(service => ({
      id: service.product_id, name: service.name, duration: service.duration_minutes, price: service.hide_price ? null : service.price,
    })),
    professionals: publicAgenda.config.professionals.filter(person => person.online_visible !== false).map(person => ({
      id: person.id, name: person.name, color: person.color, photoUrl: person.photo_url || null, specialty: person.specialty || null,
    })),
  } : null
  const after = await admin.rpc('service_website_proposal_revision', { p_organization_id: organizationId })
  if (after.error) throw new Error('PROPOSAL_UNAVAILABLE')
  if (before.data !== after.data) throw new Error('PROPOSAL_STALE')
  const current = snapshot.data.settings as Partial<WebsiteSettings>
  const capabilities = resolveStorefrontCapabilities({ businessVertical: plan.businessVertical, operatingModel: plan.operatingModel, effectiveModules: plan.effectiveModules })
  if (!capabilities.hasServices) throw new Error('SERVICES_UNAVAILABLE')
  return { proposal: buildServiceWebsiteProposal({ ...options, current, capabilities }), revision: after.data as string,
    services: (current.services ?? []).filter(s => s.active !== false), agenda, organizationSlug: slug }
}
