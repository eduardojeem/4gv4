import { ApiError, apiFetch } from './api';
import { formatGs, SITE_URL } from './marketplace';
import { formatNumber } from './settings-model';
import { toAgendaData, type AgendaData, type Appointment, type AppointmentAction, type appointmentPayload } from './agenda-model';
import { websiteErrorMessage } from './website-admin';

/**
 * Agenda en la app: las MISMAS APIs que /dashboard/agenda en la web. El
 * servidor resuelve el comercio activo y exige el permiso de ventas y el
 * módulo de servicios; la app nunca manda el comercio en el cuerpo.
 */

type Payload = ReturnType<typeof appointmentPayload>;

/** Mensaje para la persona, nunca el error técnico. */
export function agendaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return 'Tu usuario o tu plan no incluyen la agenda.';
  // 409: el servidor explica en castellano (horario ocupado, el turno cambió de estado…).
  if (error instanceof ApiError && error.status === 409 && error.message && !/^Error \d+$/.test(error.message)) return error.message;
  return websiteErrorMessage(error, fallback);
}

/** Turnos de «days» días desde «date» (en la zona del comercio) y todo lo necesario para cargar uno. */
export async function fetchAgenda(date: string, days = 7): Promise<AgendaData> {
  const params = new URLSearchParams({ date, days: String(days) });
  return toAgendaData(await apiFetch<Record<string, unknown>>(`/api/agenda?${params}`));
}

export async function fetchAppointment(id: string): Promise<Appointment> {
  const res = await apiFetch<{ appointment: Appointment }>(`/api/agenda/${encodeURIComponent(id)}`);
  return { ...res.appointment, price: Number(res.appointment.price) || 0 };
}

export async function createAppointment(payload: Payload): Promise<Appointment> {
  const res = await apiFetch<{ appointment: Appointment }>('/api/agenda', { method: 'POST', body: JSON.stringify(payload) });
  return res.appointment;
}

export async function updateAppointment(id: string, payload: Payload): Promise<Appointment> {
  const res = await apiFetch<{ appointment: Appointment }>(`/api/agenda/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'update', appointment: payload }),
  });
  return res.appointment;
}

export async function appointmentAction(id: string, action: AppointmentAction, extra: { reason?: string } = {}): Promise<Appointment> {
  const res = await apiFetch<{ appointment: Appointment }>(`/api/agenda/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, ...extra }),
  });
  return res.appointment;
}

export type CustomerMatch = { id: string; name: string; phone: string | null; whatsapp: string | null };

/** Clientes del comercio para cargar el turno (desde 2 letras). */
export async function lookupCustomers(term: string): Promise<CustomerMatch[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const res = await apiFetch<{ results?: CustomerMatch[] }>(`/api/agenda/lookup?q=${encodeURIComponent(q)}`);
  return res.results ?? [];
}

/** Donde el cliente ve, cambia o cancela su turno. */
export const appointmentPublicUrl = (token: string) => `${SITE_URL}/turno/${token}`;

export const formatMoney = (amount: number, currency: string) =>
  currency === 'PYG' ? formatGs(amount) : `${currency} ${formatNumber(amount, 2)}`;

// ─── Avisos entre pantallas ───

const listeners = new Set<() => void>();

/** Avisa a la agenda que un turno cambió (se guardó desde el formulario). */
export function notifyAgendaChanged() {
  for (const listener of listeners) listener();
}
export function onAgendaChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
