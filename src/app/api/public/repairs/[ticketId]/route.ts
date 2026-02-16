import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPublicToken, extractBearerToken } from '@/lib/public-session'
import { PublicRepair } from '@/types/public'
import { logger } from '@/lib/logger'
import { LRUCache } from '@/lib/cache'

// Cache for repair details - 100 entries, 5 minute TTL
const repairCache = new LRUCache<PublicRepair>(100, 5 * 60 * 1000)

// Cleanup expired entries every 10 minutes
setInterval(() => repairCache.cleanup(), 10 * 60 * 1000)

/**
 * GET /api/public/repairs/[ticketId]
 * Get repair details (requires valid session token)
 * Optimized with LRU cache and specific field selection
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await props.params
    
    // Extract token from httpOnly cookie or Authorization header (fallback)
    let token = request.cookies.get('repair_token')?.value
    
    if (!token) {
      const authHeader = request.headers.get('Authorization')
      token = extractBearerToken(authHeader) || undefined
    }
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticación requerido' },
        { status: 401 }
      )
    }
    
    const session = await verifyPublicToken(token)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }
    
    // Verify ticket number matches
    if (session.ticketNumber !== ticketId) {
      logger.warn('Public repair access denied - ticket mismatch', {
        requestedTicket: ticketId,
        sessionTicket: session.ticketNumber
      })
      return NextResponse.json(
        { success: false, error: 'No autorizado para ver esta reparación' },
        { status: 403 }
      )
    }
    
    // Check cache first
    const cached = repairCache.get(ticketId)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true
      })
    }
    
    const supabase = await createClient()
    
    // Fetch repair data with specific fields only
    const { data: repair, error } = await supabase
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
        customer_id
      `)
      .eq('ticket_number', ticketId)
      .single()
    
    if (error || !repair) {
      logger.error('Failed to fetch public repair', { error: error?.message, ticketId })
      return NextResponse.json(
        { success: false, error: 'Reparación no encontrada' },
        { status: 404 }
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
    
    // Cache the result
    repairCache.set(ticketId, publicRepair)
    
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

/**
 * Invalidate cache for a specific ticket (called when repair is updated)
 */
export function invalidateRepairCache(ticketId: string) {
  repairCache.delete(ticketId)
}
