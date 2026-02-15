/**
 * Security Audit Logging
 * Tracks security events for public portal access
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export type SecurityEventType = 
  | 'auth_attempt'
  | 'auth_success'
  | 'auth_failure'
  | 'token_expired'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'invalid_token'

export interface SecurityEvent {
  type: SecurityEventType
  ticketNumber: string
  contact?: string
  clientIp: string
  userAgent: string
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Hash contact information for privacy
 */
export function hashContact(contact: string): string {
  return createHash('sha256').update(contact.toLowerCase().trim()).digest('hex')
}

/**
 * Log security event to database
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const supabase = await createClient()
    
    await supabase.from('public_access_audit').insert({
      event_type: event.type,
      ticket_number: event.ticketNumber,
      contact_hash: event.contact ? hashContact(event.contact) : null,
      client_ip: event.clientIp,
      user_agent: event.userAgent,
      reason: event.reason,
      metadata: event.metadata,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    // Don't throw - logging should not break the main flow
    console.error('Failed to log security event:', error)
  }
}

/**
 * Get recent failed attempts for a ticket
 */
export async function getFailedAttempts(
  ticketNumber: string,
  windowMinutes: number = 15
): Promise<number> {
  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    
    const { count } = await supabase
      .from('public_access_audit')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_number', ticketNumber)
      .eq('event_type', 'auth_failure')
      .gte('created_at', since)
    
    return count || 0
  } catch (error) {
    console.error('Failed to get failed attempts:', error)
    return 0
  }
}

/**
 * Check if IP is blocked due to excessive failures
 */
export async function isIpBlocked(
  clientIp: string,
  maxAttempts: number = 10,
  windowMinutes: number = 15
): Promise<{ blocked: boolean; attemptsCount: number }> {
  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    
    const { count } = await supabase
      .from('public_access_audit')
      .select('*', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .in('event_type', ['auth_failure', 'rate_limit_exceeded'])
      .gte('created_at', since)
    
    const attemptsCount = count || 0
    return {
      blocked: attemptsCount >= maxAttempts,
      attemptsCount
    }
  } catch (error) {
    console.error('Failed to check IP block status:', error)
    return { blocked: false, attemptsCount: 0 }
  }
}
