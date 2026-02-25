import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { repairAuthSchema } from '@/schemas/public-auth.schema'
import { generatePublicToken } from '@/lib/public-session'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { PublicRepair, RepairAuthResponse } from '@/types/public'
import { logger } from '@/lib/logger'
import { logSecurityEvent, isIpBlocked } from '@/lib/security-audit'

/**
 * POST /api/public/repairs/auth
 * Authenticate to view repair status
 * Rate limited: 10 attempts per 15 minutes per IP
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  try {
    // 1. IP Block check (Persistent DB-based rate limiting)
    // Checks failures and rate limit events in the last 15 minutes
    const { blocked, attemptsCount } = await isIpBlocked(clientIp, 10, 15)
    
    if (blocked) {
      const resetTime = 15 * 60 // Estimate 15 mins
      
      await logSecurityEvent({
        type: 'rate_limit_exceeded',
        ticketNumber: 'unknown',
        clientIp,
        userAgent,
        reason: `IP blocked after ${attemptsCount} failed/excessive attempts (DB-based)`,
        metadata: { attemptsCount }
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Demasiados intentos fallidos. Tu IP ha sido bloqueada temporalmente. Intenta de nuevo en 15 minutos.' 
        },
        { 
          status: 429,
          headers: { 'Retry-After': resetTime.toString() }
        }
      )
    }
    
    // 2. In-memory Rate limiting (Burst protection)
    const isAllowed = rateLimiter.check(clientIp, 10, 15 * 60 * 1000)
    
    if (!isAllowed) {
      const resetTime = rateLimiter.getResetTime(clientIp)
      
      await logSecurityEvent({
        type: 'rate_limit_exceeded',
        ticketNumber: 'unknown',
        clientIp,
        userAgent,
        reason: `Memory rate limit exceeded`,
        metadata: { resetTime }
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Demasiados intentos. Intenta de nuevo en ${resetTime} segundos.` 
        },
        { 
          status: 429,
          headers: { 'Retry-After': resetTime.toString() }
        }
      )
    }
    
    const body = await request.json()
    
    
    // Validate input
    const validation = repairAuthSchema.safeParse(body)
    if (!validation.success) {
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber: body.ticketNumber || 'invalid',
        contact: body.contact,
        clientIp,
        userAgent,
        reason: 'Invalid input data',
        metadata: { errors: validation.error.issues }
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos',
          details: validation.error.issues.map(i => i.message)
        },
        { status: 400 }
      )
    }
    
    const { contact, ticketNumber } = validation.data
    const normalizedTicket = ticketNumber.trim().toUpperCase()
    const normalizedContact = contact.trim()
    
    // Log auth attempt
    await logSecurityEvent({
      type: 'auth_attempt',
      ticketNumber: normalizedTicket,
      contact: normalizedContact,
      clientIp,
      userAgent
    })
    
    const supabase = await createClient()
    
    // Query repair
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
      .eq('ticket_number', normalizedTicket)
      .single()
    
    if (error || !repair) {
      logger.warn('Public repair auth failed - ticket not found', { ticketNumber: normalizedTicket, clientIp })
      
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber: normalizedTicket,
        contact: normalizedContact,
        clientIp,
        userAgent,
        reason: 'Ticket not found'
      })
      
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado o datos incorrectos' },
        { status: 401 }
      )
    }
    
    // Fetch customer and technician details
    const [customerResult, technicianResult] = await Promise.all([
      supabase.from('customers').select('name, email, phone').eq('id', repair.customer_id).single(),
      repair.technician_id
        ? supabase.from('profiles').select('full_name').eq('id', repair.technician_id).single()
        : Promise.resolve({ data: null, error: null })
    ])
    const customer = customerResult.data
    
    if (!customer) {
      logger.warn('Public repair auth failed - no customer data', { ticketNumber: normalizedTicket, clientIp })
      
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber: normalizedTicket,
        contact: normalizedContact,
        clientIp,
        userAgent,
        reason: 'No customer data'
      })
      
      return NextResponse.json(
        { success: false, error: 'Datos de cliente no encontrados' },
        { status: 401 }
      )
    }
    
    // Normalizar email y teléfono (manejar strings vacíos)
    const customerEmail = customer.email?.trim() || null
    const customerPhone = customer.phone?.trim() || null
    const inputContact = normalizedContact
    
    // Verificar si el contacto coincide con email o teléfono
    const emailMatch = customerEmail && 
      customerEmail.toLowerCase() === inputContact.toLowerCase()
    
    const normalizePhone = (value: string) => value.replace(/\D/g, '')
    const customerPhoneNormalized = customerPhone ? normalizePhone(customerPhone) : ''
    const inputPhoneNormalized = normalizePhone(inputContact)
    const phoneMatch = !!customerPhoneNormalized &&
      !!inputPhoneNormalized &&
      (
        customerPhoneNormalized === inputPhoneNormalized ||
        customerPhoneNormalized.endsWith(inputPhoneNormalized) ||
        inputPhoneNormalized.endsWith(customerPhoneNormalized)
      )
    
    const contactMatch = emailMatch || phoneMatch
    
    if (!contactMatch) {
      logger.warn('Public repair auth failed - contact mismatch', { 
        ticketNumber: normalizedTicket, 
        contact: inputContact, 
        clientIp,
        customerEmail: customerEmail || '(vacío)',
        customerPhone: customerPhone || '(vacío)',
        hasEmail: !!customerEmail,
        hasPhone: !!customerPhone
      })
      
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber: normalizedTicket,
        contact: normalizedContact,
        clientIp,
        userAgent,
        reason: 'Contact mismatch'
      })
      
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado o datos incorrectos' },
        { status: 401 }
      )
    }
    
    // Generate token
    const tokenExpiresIn = 30 * 60 // 30 minutes
    const token = await generatePublicToken({
      repairId: repair.id,
      ticketNumber: repair.ticket_number,
      contact: normalizedContact
    }, tokenExpiresIn)
    
    // Build public repair object
    const publicRepair: PublicRepair = {
      ticketNumber: repair.ticket_number,
      device: `${repair.device_brand || ''} ${repair.device_model || ''}`.trim() || repair.device_type || 'Dispositivo',
      brand: repair.device_brand || '',
      model: repair.device_model || '',
      deviceType: repair.device_type || '',
      issue: repair.problem_description || '',
      status: repair.status,
      priority: repair.priority,
      createdAt: repair.created_at,
      estimatedCompletion: repair.estimated_completion || null,
      completedAt: repair.completed_at || null,
      estimatedCost: repair.estimated_cost || 0,
      finalCost: repair.final_cost,
      warrantyMonths: repair.warranty_months,
      warrantyType: repair.warranty_type,
      technician: technicianResult.data?.full_name ? {
        name: technicianResult.data.full_name
      } : null,
      customer: {
        name: customer.name || 'Cliente',
        phone: customer.phone || ''
      }
    }
    
    logger.info('Public repair auth successful', { ticketNumber: normalizedTicket, clientIp })
    
    // Log successful authentication
    await logSecurityEvent({
      type: 'auth_success',
      ticketNumber: normalizedTicket,
      contact: normalizedContact,
      clientIp,
      userAgent,
      metadata: { repairId: repair.id }
    })
    
    const response: RepairAuthResponse = {
      token,
      repair: publicRepair,
      expiresIn: tokenExpiresIn
    }
    
    // Set httpOnly cookie for security
    const nextResponse = NextResponse.json({
      success: true,
      data: response
    })
    
    nextResponse.cookies.set('repair_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: tokenExpiresIn,
      path: '/'
    })
    
    return nextResponse
  } catch (error) {
    console.error('[Auth API] Global catch error:', error)
    logger.error('Public repair auth error', { error })
    return NextResponse.json(
      { success: false, error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
