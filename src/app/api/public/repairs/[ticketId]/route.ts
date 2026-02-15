import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPublicToken, extractBearerToken } from '@/lib/public-session'
import { PublicRepair } from '@/types/public'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/repairs/[ticketId]
 * Get repair details (requires valid session token)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const { ticketId } = params
    
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
    
    const supabase = await createClient()
    
    // Fetch repair data
    const { data: repair, error } = await supabase
      .from('repairs')
      .select(`
        id,
        ticket_number,
        device,
        brand,
        model,
        deviceType,
        issue,
        description,
        status,
        priority,
        created_at,
        estimatedCost,
        finalCost,
        warrantyMonths,
        warrantyType,
        warrantyNotes,
        estimatedCompletion,
        completedAt,
        technician:technicians(name),
        customer:customers(name, phone)
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
    
    // Fetch status history
    const { data: statusHistory } = await supabase
      .from('repair_status_history')
      .select('status, note, created_at')
      .eq('repair_id', repair.id)
      .order('created_at', { ascending: true })
    
    // Build public repair object (filter sensitive data)
    const publicRepair: PublicRepair = {
      ticketNumber: repair.ticket_number,
      device: repair.device,
      brand: repair.brand,
      model: repair.model,
      deviceType: repair.deviceType,
      issue: repair.issue,
      status: repair.status,
      priority: repair.priority,
      createdAt: repair.created_at,
      estimatedCompletion: repair.estimatedCompletion || null,
      completedAt: repair.completedAt || null,
      estimatedCost: repair.estimatedCost || 0,
      finalCost: repair.finalCost,
      warrantyMonths: repair.warrantyMonths,
      warrantyType: repair.warrantyType,
      statusHistory: statusHistory || [],
      technician: repair.technician ? {
        name: (repair.technician as any).name
      } : null,
      customer: {
        name: (repair.customer as any).name,
        phone: (repair.customer as any).phone
      }
    }
    
    return NextResponse.json({
      success: true,
      data: publicRepair
    })
  } catch (error) {
    logger.error('Public repair detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error al obtener detalles de reparación' },
      { status: 500 }
    )
  }
}
