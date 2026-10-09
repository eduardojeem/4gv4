import { NextResponse } from 'next/server'
import { resolvePublicAgenda } from '@/lib/agenda/public-agenda-server'
import { quoteInputSchema, publicQuoteSummary, bookingWriteError, type BookingQuote } from '@/lib/agenda/booking-writes'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const input = quoteInputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'Servicio, profesional u horario inválido.' }, { status: 400 })
  const agenda = await resolvePublicAgenda(slug)
  if (!agenda) return NextResponse.json({ error: 'Esta tienda no toma turnos online.' }, { status: 404 })
  if (!(await rateLimiter.check(`agenda-quote:${agenda.organization.id}:${getClientIp(request)}`, 30, 10 * 60_000))) return NextResponse.json({ error: 'Probá en unos minutos.' }, { status: 429 })
  if (!agenda.config.capabilities.professionalBooking) return NextResponse.json({ error: 'La reserva por profesional todavía no está habilitada.' }, { status: 503 })
  const { data, error } = await agenda.admin.rpc('create_agenda_quote', { p_org: agenda.organization.id, p_product: input.data.service_id, p_prof: input.data.professional_id ?? null, p_start: input.data.starts_at })
  if (error || !data) { const failure = bookingWriteError(error); return NextResponse.json(failure, { status: failure.status }) }
  const quote = data as BookingQuote
  return NextResponse.json(publicQuoteSummary(quote, agenda.config.professionals.find(p => p.id === quote.professional_id)?.name ?? null), { headers: { 'Cache-Control': 'no-store' } })
}
