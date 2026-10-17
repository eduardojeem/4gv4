import { addDays, dayRangeUtc, todayIn, DEFAULT_TIMEZONE } from '@/lib/agenda/time'

export function homeCalendar(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
 const today = todayIn(timeZone, now.getTime())
 const bounds = dayRangeUtc(today, timeZone)
 const last7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
 return {
  today,
  startOfDay: new Date(bounds.start),
  endOfDay: new Date(bounds.end - 1),
  startOfWeek: new Date(dayRangeUtc(last7Days[0], timeZone).start),
  last7Days,
 }
}
