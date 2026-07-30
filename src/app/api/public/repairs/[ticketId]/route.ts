import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  extractBearerToken,
  isPublicRepairSessionAuthorized,
  verifyPublicToken,
} from '@/lib/public-session'
import { verifyRepairHash } from '@/lib/repair-qr'
import { PublicRepair } from '@/types/public'
import { logger } from '@/lib/logger'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'

/**
 * GET /api/public/repairs/[ticketId]
 * Get repair details (requires valid session token OR valid QR hash)
 * Optimized with LRU cache and specific field selection
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await props.params
    const searchParams = request.nextUrl.searchParams
    const verifyHash = searchParams.get('verify')
    const organizationSlug = searchParams.get('org')?.trim() || null
    const organization = organizationSlug
      ? await resolvePublicOrganizationBySlug(organizationSlug, createAdminSupabase())
      : null
    if (organizationSlug && !organization) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }
    
    // 1. Try authentication via Token
    let token = request.cookies.get('repair_token')?.value
    if (!token) {
      const authHeader = request.headers.get('Authorization')
      token = extractBearerToken(authHeader) || undefined
    }

    const session = token ? await verifyPublicToken(token) : null
    const hasMatchingTokenTicket = session?.ticketNumber === ticketId
    const tokenMatchesRequestedOrganization =
      !organization || session?.organizationId === organization.id
    const hasAuthorizedTokenClaims = Boolean(
      session && hasMatchingTokenTicket && tokenMatchesRequestedOrganization
    )

    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    let customerIdForUser: string | null = null

    if (user && organization) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      customerIdForUser = customerData?.id ?? null
    }

    // 2. If not authenticated via token, QR hash, or tenant customer session, reject
    if ((!hasMatchingTokenTicket || !tokenMatchesRequestedOrganization) && !verifyHash && !customerIdForUser) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticación requerido' },
        { status: 401 }
      )
    }
    
    // Fetch repair data with specific fields only
    let repairQuery = supabase
      .from('repairs')
      .select(`
        id,
        ticket_number,
        device_brand,
        device_model,
        device_type,
        problem_description,
        status,
        priority,
        created_at,
        estimated_cost,
        final_cost,
        warranty_months,
        warranty_type,
        estimated_completion,
        completed_at,
        technician_id,
        customer_id,
        organization_id
      `)
      .eq('ticket_number', ticketId)

    if (organization) {
      repairQuery = repairQuery.eq('organization_id', organization.id)
    }

    if (hasAuthorizedTokenClaims && session) {
      repairQuery = repairQuery
        .eq('id', session.repairId)
        .eq('organization_id', session.organizationId)
    }

    if (customerIdForUser && !hasAuthorizedTokenClaims && !verifyHash) {
      repairQuery = repairQuery.eq('customer_id', customerIdForUser)
    }

    const { data: repair, error } = await repairQuery.single()
    
    if (error || !repair) {
      logger.error('Failed to fetch public repair', { error: error?.message, ticketId })
      return NextResponse.json(
        { success: false, error: 'Reparación no encontrada' },
        { status: 404 }
      )
    }

    const isTokenAuthorized = isPublicRepairSessionAuthorized(session, {
      repairId: repair.id,
      ticketNumber: repair.ticket_number,
      organizationId: repair.organization_id,
    })

    if (!isTokenAuthorized && !verifyHash && !customerIdForUser) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Fetch related data in parallel
    const [technicianResult, customerResult, statusHistoryResult] = await Promise.all([
      repair.technician_id 
        ? supabase.from('profiles').select('full_name').eq('id', repair.technician_id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('customers').select('name, phone').eq('id', repair.customer_id).single(),
      supabase
        .from('repair_status_history')
        .select('status, note, created_at')
        .eq('repair_id', repair.id)
        .order('created_at', { ascending: true })
    ])

    // 4. If relying on Hash, verify it now using the fetched data
    if (!isTokenAuthorized && verifyHash) {
      const customerId = repair.customer_id || ''
      const customerName = customerResult.data?.name || ''
      const repairDate = new Date(repair.created_at)
      
      const isValid =
        (customerId ? verifyRepairHash(ticketId, customerId, repairDate, verifyHash) : false) ||
        (customerName ? verifyRepairHash(ticketId, customerName, repairDate, verifyHash) : false)

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Enlace de verificación inválido o expirado' },
          { status: 403 }
        )
      }
    }
    
    // Build public repair object (filter sensitive data)
    const publicRepair: PublicRepair = {
      ticketNumber: repair.ticket_number,
      device: `${repair.device_brand} ${repair.device_model}`,
      brand: repair.device_brand,
      model: repair.device_model,
      deviceType: repair.device_type,
      issue: repair.problem_description,
      status: repair.status,
      priority: repair.priority,
      createdAt: repair.created_at,
      estimatedCompletion: repair.estimated_completion || null,
      completedAt: repair.completed_at || null,
      estimatedCost: repair.estimated_cost || 0,
      finalCost: repair.final_cost,
      warrantyMonths: repair.warranty_months,
      warrantyType: repair.warranty_type,
      statusHistory: statusHistoryResult.data || [],
      technician: technicianResult.data ? {
        name: technicianResult.data.full_name
      } : null,
      customer: {
        name: customerResult.data?.name || 'Cliente',
        phone: customerResult.data?.phone || ''
      }
    }
    
    return NextResponse.json({
      success: true,
      data: publicRepair,
      cached: false
    })
  } catch (error) {
    logger.error('Public repair detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error al obtener detalles de reparación' },
      { status: 500 }
    )
  }
}
