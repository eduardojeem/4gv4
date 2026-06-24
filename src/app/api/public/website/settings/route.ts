import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { WebsiteSettings } from '@/types/website-settings'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { resolvePublicOrganization, toPublicOrganizationPayload } from '@/lib/saas/public-tenant'

/**
 * GET /api/public/website/settings
 * Obtener configuraciones del sitio web (público)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const { data: settings, error } = await supabase
      .from('website_settings')
      .select('key, value')
      .eq('organization_id', organization.id)

    if (error) {
      throw error
    }

    // Transformar array a objeto
    const settingsObj: Partial<WebsiteSettings> = {}
    settings?.forEach((setting) => {
      settingsObj[setting.key as keyof WebsiteSettings] = setting.value
    })

    const normalized = applyWebsiteSettingsDefaults(settingsObj)

    // When the tenant hasn't customized its public name, fall back to the
    // organization's real name (never a hardcoded brand).
    if (!normalized.company_info.name?.trim()) {
      normalized.company_info.name = organization.name
    }
    normalized.company_info.slug = organization.slug

    normalized.checkout = {
      ...normalized.checkout,
      payment: {
        ...normalized.checkout.payment,
        transfer: {
          enabled: normalized.checkout.payment.transfer.enabled,
          label: normalized.checkout.payment.transfer.label,
          instructions: normalized.checkout.payment.transfer.instructions,
        },
        digital_wallet: {
          enabled: normalized.checkout.payment.digital_wallet.enabled,
          label: normalized.checkout.payment.digital_wallet.label,
          instructions: normalized.checkout.payment.digital_wallet.instructions,
        },
      },
    }

    const response = NextResponse.json({
      success: true,
      data: normalized,
      organization: toPublicOrganizationPayload(organization),
    })
    response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60')
    return response
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch website settings' },
      { status: 500 }
    )
  }
}
