import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function GET() {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('phone,sent_at,status,source')
      .order('sent_at', { ascending: false })
      .limit(5000)

    if (error) {
      console.error('WhatsApp stats GET error:', error)
      return NextResponse.json({ ok: false, error: 'No se pudieron cargar métricas' }, { status: 500 })
    }

    const messages = data || []
    const now = new Date()
    const today = startOfDay(now)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const todayMessages = messages.filter((m) => new Date(m.sent_at) >= today)
    const weekMessages = messages.filter((m) => new Date(m.sent_at) >= weekAgo)
    const monthMessages = messages.filter((m) => new Date(m.sent_at) >= monthAgo)

    const uniqueContacts = new Set(messages.map((m) => m.phone)).size

    const byStatus = messages.reduce(
      (acc, m) => {
        const key = (m.status || 'pending') as 'pending' | 'sent' | 'failed'
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      { pending: 0, sent: 0, failed: 0 }
    )

    const bySource = messages.reduce(
      (acc, m) => {
        const key = (m.source || 'manual') as 'manual' | 'bulk' | 'auto'
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      { manual: 0, bulk: 0, auto: 0 }
    )

    const last7Days = [] as Array<{ name: string; mensajes: number }>
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dayCount = messages.filter((m) => {
        const sent = new Date(m.sent_at)
        return sent.toDateString() === day.toDateString()
      }).length

      last7Days.push({
        name: day.toLocaleDateString('es-PY', { weekday: 'short' }),
        mensajes: dayCount,
      })
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total: messages.length,
        today: todayMessages.length,
        thisWeek: weekMessages.length,
        thisMonth: monthMessages.length,
        uniqueContacts,
        avgPerDay: monthMessages.length > 0 ? Math.round(monthMessages.length / 30) : 0,
      },
      chartData: last7Days,
      breakdown: {
        byStatus,
        bySource,
      },
    })
  } catch (error) {
    console.error('WhatsApp stats route error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

