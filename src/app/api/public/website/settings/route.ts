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
          bankAlias: normalized.checkout.payment.transfer.bankAlias,
          bankCbu: normalized.checkout.payment.transfer.bankCbu,
          bankName: normalized.checkout.payment.transfer.bankName,
          transferOptions: normalized.checkout.payment.transfer.transferOptions?.map((option) => ({
            id: option.id,
            bankName: option.bankName,
            alias: option.alias,
            accountNumber: option.accountNumber,
            accountHolder: option.accountHolder,
          })),
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
    // 30 s fresh, luego sirve el cache mientras revalida en background.
    // El `s-maxage` aplica al CDN/edge (ej: Vercel). `private` queda
    // excluido a propósito: los settings públicos son los mismos para
    // todos los visitantes del mismo org.
    response.headers.set(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
    )
    return response
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch website settings' },
      { status: 500 }
    )
  }
}
