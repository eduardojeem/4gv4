export const DEFAULT_CREDIT_TIMEZONE = 'America/Asuncion'
export function creditCalendarDate(value: string | Date, timeZone = DEFAULT_CREDIT_TIMEZONE): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed=new Date(value+'T12:00:00Z')
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value ? value : null
  }
  const date=value instanceof Date?value:new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  try {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
    return ['year','month','day'].map(key=>parts.find(part=>part.type===key)?.value).join('-')
  } catch { return timeZone===DEFAULT_CREDIT_TIMEZONE?null:creditCalendarDate(date,DEFAULT_CREDIT_TIMEZONE) }
}
export function paymentCalendarStatus(paidAt:string,dueDate:string,timeZone=DEFAULT_CREDIT_TIMEZONE):'on_time'|'late'|null {
  const paid=creditCalendarDate(paidAt,timeZone),due=creditCalendarDate(dueDate,timeZone)
  return paid && due ? paid>due?'late':'on_time' : null
}
export function daysUntilCreditDue(dueDate:string|null|undefined,timeZone=DEFAULT_CREDIT_TIMEZONE,now=new Date()):number|null {
  if (!dueDate) return null
  const due=creditCalendarDate(dueDate,timeZone),today=creditCalendarDate(now,timeZone)
  return due && today ? Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000) : null
}
