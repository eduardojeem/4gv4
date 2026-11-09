import { normalizePhone } from '@/lib/customers/contact-rules'
/** Full numbers only. Paraguay mobile prefixes have a known local equivalent. Never compare suffixes. */
export function appointmentPhoneMatches(left: string | null | undefined, right: string | null | undefined): boolean {
 const key = (phone: string | null | undefined) => {
  const digits = normalizePhone(phone)
  if (/^5950?9\d{8}$/.test(digits)) return '595' + digits.slice(3).replace(/^0/, '')
  if (/^09\d{8}$/.test(digits)) return '595' + digits.slice(1)
  return digits
 }
 const a = key(left), b = key(right)
 return a.length >= 6 && a === b
}
