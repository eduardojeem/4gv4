import { NextResponse, type NextRequest } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isCustomerRole } from '@/lib/admin/contact-privacy'
import { COMPLETED_SALE_STATUSES } from '@/lib/sales-status'
import { logger } from '@/lib/logger'

/**
 * Los datos con los que la guía responde «¿en qué paso estás?».
 *
 * El onboarding marca `completed` cuando la persona termina el formulario, y
 * eso no dice si el negocio quedó operativo: hay empresas «completas» sin un
 * producto, sin caja y sin ventas. Acá se cuenta lo que realmente existe.
 */

type CompanyInfo = {
  name?: string
  phone?: string
  whatsapp?: string
  address?: string
}

async function handler(_request: NextRequest, context: AdminAuthContext) {
  const organizationId = context.organizationId

  // Un super admin no tiene organización propia: la guía no tiene qué medir.
  if (!organizationId) {
    return NextResponse.json({ success: true, data: null, reason: 'no_organization' })
  }

  const admin = createAdminSupabase()

  try {
    const [organization, companyInfo, branch, products, registers, sales, members] = await Promise.all([
      admin.from('organizations').select('name, storefront_public').eq('id', organizationId).maybeSingle(),
      admin.from('website_settings').select('value').eq('organization_id', organizationId).eq('key', 'company_info').maybeSingle(),
      admin.from('branches').select('phone, address').eq('organization_id', organizationId).eq('is_default', true).maybeSingle(),
      admin.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
      admin.from('cash_registers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      admin.from('sales').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('status', [...COMPLETED_SALE_STATUSES]),
      admin.from('organization_members').select('role, status').eq('organization_id', organizationId),
    ])

    const company = (companyInfo.data?.value ?? {}) as CompanyInfo
    // El teléfono sirve igual si está cargado como WhatsApp o en la sucursal:
    // lo que importa es que el cliente tenga por dónde escribir.
    const contactPhone = company.whatsapp?.trim() || company.phone?.trim() || branch.data?.phone?.trim() || ''
    const address = company.address?.trim() || branch.data?.address?.trim() || ''

    const staffMembers = (members.data ?? []).filter((member) => {
      if (isCustomerRole(member.role)) return false
      return member.status !== 'inactive' && member.status !== 'suspended'
    }).length

    return NextResponse.json({
      success: true,
      data: {
        businessName: company.name?.trim() || organization.data?.name || '',
        contactPhone,
        address,
        activeProducts: products.count ?? 0,
        cashRegisters: registers.count ?? 0,
        completedSales: sales.count ?? 0,
        storefrontPublic: Boolean(organization.data?.storefront_public),
        staffMembers,
      },
    })
  } catch (error) {
    logger.error('No se pudo calcular los primeros pasos', { error, organizationId })
    return NextResponse.json({ success: false, error: 'No se pudo calcular el avance' }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
