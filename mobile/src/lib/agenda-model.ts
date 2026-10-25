/**
 * Agenda (turnos) en la app: los MISMOS datos y reglas que /dashboard/agenda en
 * la web. Lógica pura, sin React Native, para poder probarla. Las fechas se
 * calculan en la zona horaria del comercio, no en la del teléfono.
 */

// ─── Tipos que devuelve /api/agenda ────────────────────────────────────────

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type Appointment = {
  id: string;
  number: number;
  professional_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  service_product_id: string | null;
  service_name: string;
  price: number;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: 'dashboard' | 'online';
  notes: string | null;
  cancel_reason: string | null;
  public_token: string;
  sale_id: string | null;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  buffer_minutes?: number;
};

/** Día de la semana (0 = domingo) → tramos [["08:00","12:00"], ...]. */
export type OpeningHours = Record<string, [string, string][]>;

export type AgendaProfessional = {
  id: string;
  name: string;
  color: string;
  phone: string | null;
  is_active: boolean;
  sort_order: number;
  specialty?: string | null;
  opening_hours?: OpeningHours | null;
  /** Servicios que hace. Vacío = todos. */
  service_ids?: string[];
};

export type AgendaService = {
  product_id: string;
  name: string;
  price: number;
  hide_price: boolean;
  duration_minutes: number;
  buffer_minutes?: number;
  online: boolean;
  configured: boolean;
};

export type ProfessionalRate = {
  professional_id: string;
  product_id: string;
  price: number | null;
  duration_minutes: number | null;
  buffer_minutes: number | null;
};

export type AgendaData = {
  available: boolean;
  date: string;
  days: number;
  appointments: Appointment[];
  pendingCount: number;
  settings: { slot_minutes: number; opening_hours: OpeningHours; professional_selection?: 'disabled' | 'optional' | 'required' };
  professionals: AgendaProfessional[];
  services: AgendaService[];
  professionalRates: ProfessionalRate[];
  capabilities: { professionalBooking: boolean };
  timeZone: string;
  currency: string;
  storeName: string;
  storeSlug: string;
  canConfigure: boolean;
};

export const DEFAULT_TIMEZONE = 'America/Asuncion';

// ─── Estados y acciones (las mismas transiciones que valida el servidor) ───

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmado',
  completed: 'Atendido',
  cancelled: 'Cancelado',
  no_show: 'No vino',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: '#D97706',
  confirmed: '#2563EB',
  completed: '#16A34A',
  cancelled: '#6B7280',
  no_show: '#DC2626',
};

export type AppointmentAction = 'confirm' | 'complete' | 'no_show' | 'cancel' | 'reopen' | 'reminder_sent';

const ACTIVE: AppointmentStatus[] = ['pending', 'confirmed'];
const FROM: Record<AppointmentAction, AppointmentStatus[]> = {
  confirm: ['pending'],
  complete: ACTIVE,
  no_show: ACTIVE,
  cancel: ACTIVE,
  reopen: ['cancelled', 'no_show', 'completed'],
  reminder_sent: ACTIVE,
};

/** Qué se puede hacer con el turno ahora. Un turno cobrado ya no se toca. */
export function canDo(appointment: Pick<Appointment, 'status' | 'sale_id'>, action: AppointmentAction | 'edit'): boolean {
  if (appointment.sale_id) return false;
  if (action === 'edit') return ACTIVE.includes(appointment.status);
  return FROM[action].includes(appointment.status);
}

export const isActive = (appointment: Pick<Appointment, 'status'>) => ACTIVE.includes(appointment.status);

// ─── Fechas en la zona del comercio (igual que src/lib/agenda/time.ts) ─────

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pad = (value: number) => String(value).padStart(2, '0');

function zonedParts(instant: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second), weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

function offsetMinutes(instant: number, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000) / 60_000);
}

/** «2026-10-15» + «09:30» en la zona → instante UTC (ms). */
export function zonedToUtc(date: string, time: string, timeZone = DEFAULT_TIMEZONE): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMinutes(guess, timeZone) * 60_000;
  return guess - offsetMinutes(first, timeZone) * 60_000;
}

export function utcToZoned(instant: number | string, timeZone = DEFAULT_TIMEZONE) {
  const p = zonedParts(typeof instant === 'string' ? Date.parse(instant) : instant, timeZone);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}`, weekday: p.weekday, minutes: p.hour * 60 + p.minute };
}

export const todayIn = (timeZone = DEFAULT_TIMEZONE, now = Date.now()) => utcToZoned(now, timeZone).date;

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const minutesOf = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};
export const timeOf = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Lunes de la semana de esa fecha. */
export const weekStart = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

/** «Hoy», «Mañana», «Ayer» o «jueves 15/10». */
export function dayLabel(date: string, today: string) {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  if (date === addDays(today, -1)) return 'Ayer';
  const [, month, day] = date.split('-');
  return `${WEEKDAY_LABELS[weekdayOf(date)].toLowerCase()} ${day}/${month}`;
}

export const shortWeekday = (date: string) => WEEKDAY_SHORT[weekdayOf(date)];
export const dayOfMonth = (date: string) => Number(date.slice(8, 10));

/** «jueves 15/10 a las 09:30», igual que el mensaje de la web. */
export function appointmentWhen(startsAt: string, timeZone: string) {
  const local = utcToZoned(startsAt, timeZone);
  const [, month, day] = local.date.split('-');
  return `${WEEKDAY_LABELS[local.weekday].toLowerCase()} ${day}/${month} a las ${local.time}`;
}

export const appointmentCode = (number: number) => `T-${String(number).padStart(5, '0')}`;

export const durationOf = (appointment: Pick<Appointment, 'starts_at' | 'ends_at'>) =>
  Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000);

/** Los turnos de un día local, en orden, opcionalmente de un profesional. */
export function appointmentsOn(appointments: Appointment[], date: string, timeZone: string, professionalId?: string | null) {
  return appointments
    .filter((item) => utcToZoned(item.starts_at, timeZone).date === date)
    .filter((item) => (professionalId ? item.professional_id === professionalId : true))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** Cuántos turnos activos (pendientes o confirmados) hay cada día. */
export function activeCountByDay(appointments: Appointment[], timeZone: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of appointments) {
    if (!isActive(item)) continue;
    const date = utcToZoned(item.starts_at, timeZone).date;
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

// ─── Horarios para elegir ──────────────────────────────────────────────────

/**
 * Horarios de un día según el horario de atención (del profesional si tiene
 * uno propio) cada «slot_minutes». Sin tramos ese día, la lista queda vacía.
 */
export function timeOptions(date: string, openingHours: OpeningHours, slotMinutes: number, durationMinutes: number): string[] {
  const ranges = openingHours[String(weekdayOf(date))] ?? [];
  const step = Math.max(5, slotMinutes || 30);
  const options: string[] = [];
  for (const [from, to] of ranges) {
    for (let minute = minutesOf(from); minute + Math.max(5, durationMinutes) <= minutesOf(to); minute += step) options.push(timeOf(minute));
  }
  return options;
}

export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Si el turno cae dentro del horario de atención de ese día. */
export function withinHours(date: string, time: string, durationMinutes: number, openingHours: OpeningHours): boolean {
  const start = minutesOf(time);
  return (openingHours[String(weekdayOf(date))] ?? []).some(([from, to]) => start >= minutesOf(from) && start + durationMinutes <= minutesOf(to));
}

// ─── Servicio, profesional y condiciones ───────────────────────────────────

export const professionalDoesService = (professional: Pick<AgendaProfessional, 'service_ids'>, serviceId: string) =>
  !professional.service_ids?.length || professional.service_ids.includes(serviceId);

export type ServiceTerms = { price: number; durationMinutes: number; bufferMinutes: number };

/**
 * Precio y duración para un servicio con un profesional: la tarifa propia del
 * profesional si tiene, si no la del servicio. Al editar sin cambiar servicio
 * ni profesional, se conserva lo acordado (como la web).
 */
export function serviceTerms(
  service: Pick<AgendaService, 'product_id' | 'price' | 'duration_minutes' | 'buffer_minutes'>,
  professionalId: string | null,
  rates: ProfessionalRate[],
  original: Pick<Appointment, 'service_product_id' | 'professional_id' | 'price' | 'starts_at' | 'ends_at' | 'buffer_minutes'> | null,
): ServiceTerms {
  if (original && original.service_product_id === service.product_id && original.professional_id === professionalId) {
    return { price: Number(original.price), durationMinutes: durationOf(original), bufferMinutes: original.buffer_minutes ?? 0 };
  }
  const rate = rates.find((row) => row.product_id === service.product_id && row.professional_id === professionalId);
  return {
    price: rate?.price ?? service.price,
    durationMinutes: rate?.duration_minutes ?? service.duration_minutes,
    bufferMinutes: rate?.buffer_minutes ?? service.buffer_minutes ?? 0,
  };
}

// ─── Formulario ────────────────────────────────────────────────────────────

/** Servicio escrito a mano, sin elegir uno del catálogo. */
export const FREE_SERVICE = '__free__';

export type AppointmentForm = {
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  service: string | null;
  serviceName: string;
  professionalId: string | null;
  date: string;
  time: string;
  duration: string;
  price: string;
  buffer: number;
  notes: string;
  pending: boolean;
  acceptNewTerms: boolean;
  allowOutsideHours: boolean;
};

export function emptyForm(data: Pick<AgendaData, 'settings'>, date: string, time = '', professionalId: string | null = null): AppointmentForm {
  return {
    customerId: null, customerName: '', customerPhone: '', service: null, serviceName: '', professionalId,
    date, time, duration: String(data.settings.slot_minutes || 30), price: '0', buffer: 0, notes: '', pending: false,
    acceptNewTerms: false, allowOutsideHours: false,
  };
}

export function formFromAppointment(appointment: Appointment, timeZone: string): AppointmentForm {
  const local = utcToZoned(appointment.starts_at, timeZone);
  return {
    customerId: appointment.customer_id, customerName: appointment.customer_name, customerPhone: appointment.customer_phone ?? '',
    service: appointment.service_product_id ?? FREE_SERVICE, serviceName: appointment.service_name, professionalId: appointment.professional_id,
    date: local.date, time: local.time, duration: String(durationOf(appointment)), price: String(Number(appointment.price)),
    buffer: appointment.buffer_minutes ?? 0, notes: appointment.notes ?? '', pending: appointment.status === 'pending',
    acceptNewTerms: false, allowOutsideHours: false,
  };
}

const toNumber = (value: string) => Number(value.replace(/\./g, '').replace(',', '.'));

/** Si al editar se cambió servicio o profesional (con reservas por profesional hay que aceptar las nuevas condiciones). */
export const termsChanged = (form: AppointmentForm, original: Appointment | null) =>
  Boolean(original) && (form.service !== (original!.service_product_id ?? FREE_SERVICE) || form.professionalId !== original!.professional_id);

export function formIssues(form: AppointmentForm, data: Pick<AgendaData, 'professionals' | 'capabilities'>, original: Appointment | null = null): string[] {
  const issues: string[] = [];
  if (!form.customerName.trim()) issues.push('Poné el nombre del cliente.');
  if (!form.serviceName.trim()) issues.push('Elegí o escribí el servicio.');
  if (data.professionals.some((professional) => professional.is_active) && !form.professionalId) issues.push('Elegí quién atiende.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) issues.push('Elegí el día.');
  if (!isValidTime(form.time)) issues.push('Elegí la hora (por ejemplo 09:30).');
  const duration = toNumber(form.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) issues.push('La duración tiene que ser entre 5 y 720 minutos.');
  const price = toNumber(form.price || '0');
  if (!Number.isFinite(price) || price < 0) issues.push('Revisá el precio.');
  if (data.capabilities.professionalBooking && termsChanged(form, original) && !form.acceptNewTerms) {
    issues.push('Aceptá la nueva tarifa y duración del servicio y profesional.');
  }
  return issues;
}

/** Lo que espera POST /api/agenda (o la acción «update»), igual que arma la web. */
export function appointmentPayload(form: AppointmentForm, data: Pick<AgendaData, 'timeZone' | 'settings' | 'capabilities' | 'canConfigure'>, mode: 'create' | 'edit') {
  const duration = Math.max(5, Math.trunc(toNumber(form.duration)) || data.settings.slot_minutes);
  const price = Math.max(0, toNumber(form.price || '0') || 0);
  return {
    customer_id: form.customerId,
    customer_name: form.customerName.trim(),
    customer_phone: form.customerPhone.trim() || null,
    service_product_id: !form.service || form.service === FREE_SERVICE ? null : form.service,
    service_name: form.serviceName.trim(),
    professional_id: form.professionalId,
    price,
    starts_at: new Date(zonedToUtc(form.date, form.time, data.timeZone)).toISOString(),
    duration_minutes: duration,
    notes: form.notes.trim() || null,
    ...(data.capabilities.professionalBooking
      ? {
          accept_new_terms: form.acceptNewTerms,
          accepted_terms: { price, duration_minutes: duration, buffer_minutes: form.buffer },
          allow_outside_hours: data.canConfigure && form.allowOutsideHours,
        }
      : {}),
    ...(mode === 'create' ? { status: form.pending ? 'pending' : 'confirmed' } : {}),
  };
}

// ─── WhatsApp (el mismo mensaje que la web) ────────────────────────────────

/** Número para wa.me: con 595 adelante, sin el 0 inicial. */
export function whatsappNumber(phone: string | null | undefined, countryCode = '595'): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith(countryCode)) digits = `${countryCode}${digits}`;
  else if (digits.startsWith(`${countryCode}0`)) digits = `${countryCode}${digits.slice(countryCode.length + 1)}`;
  return digits;
}

export function appointmentWhatsApp(kind: 'confirm' | 'reminder', params: {
  storeName: string; customerName: string; serviceName: string; startsAt: string; timeZone: string; professionalName?: string | null; url?: string | null;
}) {
  const firstName = params.customerName.trim().split(/\s+/)[0] || params.customerName;
  const when = appointmentWhen(params.startsAt, params.timeZone);
  const withWho = params.professionalName ? ` con ${params.professionalName}` : '';
  const lines = kind === 'confirm'
    ? [`Hola ${firstName}! Te confirmamos tu turno en ${params.storeName}:`, '', `📅 ${when}`, `✂️ ${params.serviceName}${withWho}`]
    : [`Hola ${firstName}! Te recordamos tu turno en ${params.storeName}:`, '', `📅 ${when}`, `✂️ ${params.serviceName}${withWho}`, '', '¿Venís? Respondé este mensaje para confirmar.'];
  if (params.url) lines.push('', `Ver, cambiar o cancelar tu turno: ${params.url}`);
  return lines.join('\n');
}

export function whatsappUrl(phone: string | null, message: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

/** Normaliza la respuesta del servidor (números que llegan como texto). */
export function toAgendaData(raw: Record<string, unknown>): AgendaData {
  const data = raw as Partial<AgendaData>;
  return {
    available: data.available !== false,
    date: data.date ?? todayIn(data.timeZone),
    days: Number(data.days ?? 1),
    appointments: (data.appointments ?? []).map((item) => ({ ...item, price: Number(item.price) || 0 })),
    pendingCount: Number(data.pendingCount ?? 0),
    settings: { slot_minutes: Number(data.settings?.slot_minutes ?? 30), opening_hours: data.settings?.opening_hours ?? {}, professional_selection: data.settings?.professional_selection },
    professionals: (data.professionals ?? []).slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    services: (data.services ?? []).map((service) => ({ ...service, price: Number(service.price) || 0 })),
    professionalRates: data.professionalRates ?? [],
    capabilities: { professionalBooking: data.capabilities?.professionalBooking === true },
    timeZone: data.timeZone || DEFAULT_TIMEZONE,
    currency: data.currency || 'PYG',
    storeName: data.storeName ?? '',
    storeSlug: data.storeSlug ?? '',
    canConfigure: data.canConfigure === true,
  };
}
