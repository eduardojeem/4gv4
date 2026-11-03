export type SubscriptionExpiryNotice = { title: string; dateLabel: string; expiresAt: string; tone: 'warning' | 'danger' };
type Subscription = { plan?: string | null; status?: string | null; current_period_ends_at?: string | null; trial_ends_at?: string | null; cancel_at_period_end?: boolean | null };
export const canSeeSubscriptionExpiry = (role: string, superAdmin: boolean) => superAdmin || role === 'owner' || role === 'admin';
const timeZone = 'America/Asuncion';
function calendarDay(time: number) {
  const parts = new Intl.DateTimeFormat('en', {timeZone, year:'numeric',month:'numeric',day:'numeric'}).formatToParts(time);
  const value = (kind: string) => Number(parts.find(part => part.type === kind)?.value);
  return Date.UTC(value('year'),value('month')-1,value('day')) / 86400000;
}
/** Server-calculated notice; dates reflect the business calendar, not the device clock. */
export function buildSubscriptionExpiryNotice(sub: Subscription | null, now = Date.now()): SubscriptionExpiryNotice | null {
  if (!sub || !['active','trial','trialing','past_due','expired'].includes(sub.status ?? '')) return null;
  const trial = sub.status === 'trialing' || sub.status === 'trial';
  if (!trial && (!sub.plan || sub.plan.toUpperCase() === 'FREE')) return null;
  const end = subscriptionPeriodEnd(sub);
  if (!end) return null;
  const timestamp = Date.parse(end);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return null;
  const days = calendarDay(timestamp)-calendarDay(now);
  if (days > 7) return null;
  const expired = timestamp <= now;
  const subject = trial ? 'Tu período de prueba' : 'Tu plan';
  const verb = sub.cancel_at_period_end ? 'termina' : 'vence';
  const title = expired ? subject + ' venció' : subject + ' ' + verb + (days === 0 ? ' hoy' : ' en ' + days + (days === 1 ? ' día' : ' días'));
  return { title, expiresAt: end, tone: expired ? 'danger' : 'warning', dateLabel: new Intl.DateTimeFormat('es-PY',{timeZone,day:'numeric',month:'long',year:'numeric'}).format(timestamp) };
}

export function subscriptionPeriodEnd(sub: Subscription | null | undefined) { return sub?.status === 'trialing' || sub?.status === 'trial' ? sub.trial_ends_at ?? null : sub?.current_period_ends_at ?? null; }
