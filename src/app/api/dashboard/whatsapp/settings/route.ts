import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'

interface SettingsPayload {
  businessPhone?: string
  autoNotifyRepairReady?: boolean
  autoNotifyStatusChange?: boolean
  autoPaymentReminders?: boolean
  reminderDays?: number
  businessHoursStart?: string
  businessHoursEnd?: string
}

const DEFAULT_SETTINGS = {
  businessPhone: process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS || '',
  autoNotifyRepairReady: true,
  autoNotifyStatusChange: false,
  autoPaymentReminders: false,
  reminderDays: 3,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

function normalizeSettingsRow(row: any) {
  return {
    businessPhone: row?.business_phone || DEFAULT_SETTINGS.businessPhone,
    autoNotifyRepairReady: Boolean(row?.auto_notify_repair_ready ?? DEFAULT_SETTINGS.autoNotifyRepairReady),
    autoNotifyStatusChange: Boolean(row?.auto_notify_status_change ?? DEFAULT_SETTINGS.autoNotifyStatusChange),
    autoPaymentReminders: Boolean(row?.auto_payment_reminders ?? DEFAULT_SETTINGS.autoPaymentReminders),
    reminderDays: Number(row?.reminder_days ?? DEFAULT_SETTINGS.reminderDays),
    businessHoursStart: row?.business_hours_start
      ? String(row.business_hours_start).slice(0, 5)
      : DEFAULT_SETTINGS.businessHoursStart,
    businessHoursEnd: row?.business_hours_end
      ? String(row.business_hours_end).slice(0, 5)
      : DEFAULT_SETTINGS.businessHoursEnd,
  }
}

export async function GET() {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const userId = auth.authenticated ? auth.user.id : ''

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('WhatsApp settings GET error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo cargar la configuracion' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, settings: normalizeSettingsRow(data) })
  } catch (error) {
    console.error('WhatsApp settings GET route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const userId = auth.authenticated ? auth.user.id : ''

    const body = (await request.json()) as SettingsPayload

    const reminderDays = Number(body.reminderDays ?? DEFAULT_SETTINGS.reminderDays)
    if (!Number.isFinite(reminderDays) || reminderDays < 1 || reminderDays > 30) {
      return NextResponse.json({ ok: false, error: 'invalid_reminder_days' }, { status: 400 })
    }

    const businessHoursStart = body.businessHoursStart || DEFAULT_SETTINGS.businessHoursStart
    const businessHoursEnd = body.businessHoursEnd || DEFAULT_SETTINGS.businessHoursEnd

    if (!isValidTime(businessHoursStart) || !isValidTime(businessHoursEnd)) {
      return NextResponse.json({ ok: false, error: 'invalid_business_hours' }, { status: 400 })
    }

    const supabase = await createClient()
    const payload = {
      user_id: userId,
      business_phone: (body.businessPhone || '').trim(),
      auto_notify_repair_ready: Boolean(body.autoNotifyRepairReady),
      auto_notify_status_change: Boolean(body.autoNotifyStatusChange),
      auto_payment_reminders: Boolean(body.autoPaymentReminders),
      reminder_days: Math.trunc(reminderDays),
      business_hours_start: businessHoursStart,
      business_hours_end: businessHoursEnd,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('whatsapp_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error) {
      console.error('WhatsApp settings PUT error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuracion' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, settings: normalizeSettingsRow(data) })
  } catch (error) {
    console.error('WhatsApp settings PUT route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
