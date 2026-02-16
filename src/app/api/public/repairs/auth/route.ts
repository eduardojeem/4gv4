import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { repairAuthSchema } from '@/schemas/public-auth.schema'
import { generatePublicToken } from '@/lib/public-session'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { PublicRepair, RepairAuthResponse } from '@/types/public'
import { logger } from '@/lib/logger'
import { logSecurityEvent, isIpBlocked } from '@/lib/security-audit'
import { verifyRecaptcha } from '@/lib/recaptcha'

/**
 * POST /api/public/repairs/auth
 * Authenticate to view repair status
 * Rate limited: 10 attempts per 15 minutes per IP
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  try {
    console.log('[Auth API] Received request from:', clientIp)
    
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
    
    // Verify reCAPTCHA token
    const recaptchaToken = body.recaptchaToken
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, 'repair_auth', 0.5)
      
      if (!recaptchaResult.valid) {
        await logSecurityEvent({
          type: 'auth_failure',
          ticketNumber: body.ticketNumber || 'unknown',
          contact: body.contact,
          clientIp,
          userAgent,
          reason: `reCAPTCHA failed: ${recaptchaResult.error}`,
          metadata: { score: recaptchaResult.score }
        })
        
        return NextResponse.json(
          { 
            success: false, 
            error: 'Verificación de seguridad fallida. Por favor, intenta de nuevo.' 
          },
          { status: 400 }
        )
      }
      
      // Log successful reCAPTCHA verification
      logger.info('reCAPTCHA verified', { score: recaptchaResult.score, clientIp })
    }
    
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
    
    // Log auth attempt
    await logSecurityEvent({
      type: 'auth_attempt',
      ticketNumber,
      contact,
      clientIp,
      userAgent
    })
    
    const supabase = await createClient()
    
    // Query repair with customer info
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
        status,
        priority,
        created_at,
        estimatedCost,
        finalCost,
        warrantyMonths,
        warrantyType,
        technician:technicians(id, name),
        customer:customers(id, name, email, phone)
      `)
      .eq('ticket_number', ticketNumber)
      .single()
    
    if (error || !repair) {
      logger.warn('Public repair auth failed - ticket not found', { ticketNumber, clientIp })
      
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber,
        contact,
        clientIp,
        userAgent,
        reason: 'Ticket not found'
      })
      
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado o datos incorrectos' },
        { status: 401 }
      )
    }
    
    // Verify contact matches (email or phone)
    const customer = repair.customer as any
    const contactMatch = 
      customer.email?.toLowerCase() === contact.toLowerCase() ||
      customer.phone?.replace(/\s|-/g, '') === contact.replace(/\s|-/g, '')
    
    if (!contactMatch) {
      logger.warn('Public repair auth failed - contact mismatch', { ticketNumber, contact, clientIp })
      
      await logSecurityEvent({
        type: 'auth_failure',
        ticketNumber,
        contact,
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
      contact
    }, tokenExpiresIn)
    
    // Build public repair object
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
      estimatedCost: repair.estimatedCost || 0,
      finalCost: repair.finalCost,
      warrantyMonths: repair.warrantyMonths,
      warrantyType: repair.warrantyType,
      technician: repair.technician ? {
        name: (repair.technician as any).name
      } : null,
      customer: {
        name: customer.name,
        phone: customer.phone
      }
    }
    
    logger.info('Public repair auth successful', { ticketNumber, clientIp })
    
    // Log successful authentication
    await logSecurityEvent({
      type: 'auth_success',
      ticketNumber,
      contact,
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
