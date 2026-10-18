import { apiFetch, ApiError } from './api';

/**
 * Administración en la app: resumen, monitor de cajas, equipo y reseñas, con
 * las APIs de /admin (solo dueños y administradores).
 */

const fail = (error: unknown, fallback: string): never => {
  if (error instanceof ApiError) {
    if (error.status === 403) throw new Error('Necesitás ser administrador para esto.');
    const details = error.body?.details as { message?: string }[] | undefined;
    throw new Error((Array.isArray(details) && details[0]?.message) || error.message || fallback);
  }
  throw new Error(error instanceof Error && error.message ? error.message : fallback);
};

// ─── Resumen ───────────────────────────────────────────────────────────────

export type CashSessionStatus = 'open' | 'suspended' | 'blocked';
export type OpenSession = {
  id: string;
  registerName: string;
  branchName: string;
  openingBalance: number;
  openedAt: string;
  lastActivityAt: string | null;
  status: CashSessionStatus;
  salesTotal: number;
  salesCount: number;
};

export type AdminOverview = {
  sales: { todayTotal: number; todayCount: number; monthTotal: number; monthCount: number };
  cash: OpenSession[];
  lowStock: { count: number; outOfStock: number; items: { id: string; name: string; stock: number; min: number }[] };
  team: { active: number; total: number };
  pending: { reviews: number; afterSales: number };
  branches: number;
};

export async function fetchOverview() {
  try {
    return (await apiFetch<{ data: AdminOverview }>('/api/mobile/admin/overview')).data;
  } catch (error) {
    return fail(error, 'No se pudo cargar el resumen.');
  }
}

// ─── Monitor de cajas ──────────────────────────────────────────────────────

export type CashAction = 'remote_close' | 'suspend' | 'unsuspend' | 'block' | 'unblock';

export const CASH_STATUS: Record<CashSessionStatus, { label: string; color: string }> = {
  open: { label: 'Abierta', color: '#16A34A' },
  suspended: { label: 'Suspendida', color: '#D97706' },
  blocked: { label: 'Bloqueada', color: '#DC2626' },
};

/** Las acciones que tienen sentido según el estado de la caja. */
export function cashActions(status: CashSessionStatus): { action: CashAction; label: string; destructive?: boolean; hint: string }[] {
  const close = { action: 'remote_close' as const, label: 'Cerrar a distancia', destructive: true, hint: 'Cierra el turno con lo esperado en caja. El cajero ya no puede vender.' };
  if (status === 'suspended') return [{ action: 'unsuspend', label: 'Reanudar', hint: 'El cajero puede volver a vender.' }, close];
  if (status === 'blocked') return [{ action: 'unblock', label: 'Desbloquear', hint: 'Vuelve a quedar operativa.' }, close];
  return [
    { action: 'suspend', label: 'Suspender', hint: 'Pausa la caja; se puede reanudar.' },
    { action: 'block', label: 'Bloquear', destructive: true, hint: 'Nadie puede operarla hasta desbloquearla.' },
    close,
  ];
}

export async function performCashAction(sessionId: string, action: CashAction, reason?: string) {
  try {
    await apiFetch('/api/admin/cash-monitor/actions', { method: 'POST', body: JSON.stringify({ sessionId, action, reason: reason?.trim() || undefined }) });
  } catch (error) {
    fail(error, 'No se pudo ejecutar la acción de caja.');
  }
}

// ─── Equipo ────────────────────────────────────────────────────────────────

export type TeamRole = 'admin' | 'vendedor' | 'tecnico';
export const TEAM_ROLES: { key: TeamRole; label: string; hint: string }[] = [
  { key: 'admin', label: 'Administrador', hint: 'Todo el sistema, incluida Administración.' },
  { key: 'vendedor', label: 'Vendedor', hint: 'Ventas, caja, clientes y productos.' },
  { key: 'tecnico', label: 'Técnico', hint: 'Reparaciones y su panel técnico.' },
];
export const ROLE_LABEL: Record<string, string> = { super_admin: 'Super admin', owner: 'Dueño', admin: 'Administrador', vendedor: 'Vendedor', tecnico: 'Técnico', cliente: 'Cliente' };

export type TeamUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: 'active' | 'inactive' | 'suspended' | string;
  phone: string | null;
  avatar_url: string | null;
  branches: { id: string; name: string }[];
  last_sign_in_at: string | null;
  created_at: string | null;
};

export async function fetchTeam(params: { search: string; page: number }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: '30', scope: 'staff' });
  if (params.search.trim()) query.set('search', params.search.trim());
  try {
    const result = await apiFetch<{ data: TeamUser[]; count: number; stats?: { byRole?: Record<string, number> } }>(`/api/admin/users?${query.toString()}`);
    return { rows: result.data ?? [], total: result.count ?? 0 };
  } catch (error) {
    return fail(error, 'No se pudo cargar el equipo.');
  }
}

export async function changeRole(id: string, role: TeamRole) {
  try {
    await apiFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id, role }) });
  } catch (error) {
    fail(error, 'No se pudo cambiar el rol.');
  }
}

export async function changeStatus(id: string, status: 'active' | 'inactive' | 'suspended') {
  try {
    await apiFetch(`/api/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  } catch (error) {
    fail(error, 'No se pudo cambiar el estado.');
  }
}

export async function resendInvite(id: string) {
  try {
    await apiFetch(`/api/admin/users/${id}/resend-invite`, { method: 'POST' });
  } catch (error) {
    fail(error, 'No se pudo reenviar la invitación.');
  }
}

/** Alta de un integrante: le llega un email para crear su contraseña. */
export async function inviteUser(input: { name: string; email: string; role: TeamRole; phone?: string }) {
  let result: { ok: boolean; imported: number; error?: string; results?: { error?: string }[] };
  try {
    result = await apiFetch('/api/admin/users/import', {
      method: 'POST',
      body: JSON.stringify({ users: [{ name: input.name.trim(), email: input.email.trim().toLowerCase(), role: input.role, status: 'active', phone: input.phone?.trim() || null }] }),
    });
  } catch (error) {
    return fail(error, 'No se pudo invitar al usuario.');
  }
  if (!result.ok || result.imported < 1) throw new Error(result.results?.[0]?.error || result.error || 'No se pudo invitar al usuario.');
}

// ─── Reseñas ───────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'published' | 'rejected' | 'hidden' | 'reported';
export const REVIEW_STATUS: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#D97706' },
  published: { label: 'Publicada', color: '#16A34A' },
  rejected: { label: 'Rechazada', color: '#DC2626' },
  hidden: { label: 'Oculta', color: '#64748B' },
  reported: { label: 'Reportada', color: '#7C3AED' },
};

export type Review = {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  comment: string | null;
  moderation_status: ReviewStatus;
  verification_type: 'open' | 'purchase' | 'repair' | string;
  business_response: string | null;
  created_at: string;
};

export type ReviewStats = { average: number; total: number; pending: number; published: number; rejected: number; hidden: number; respondedCount: number; satisfactionRate: number; breakdown: Record<string, number> };

export async function fetchReviews(params: { status: ReviewStatus | 'all'; offset: number }) {
  const query = new URLSearchParams({ status: params.status, limit: '20', offset: String(params.offset) });
  try {
    const result = await apiFetch<{ data: { reviews: Review[]; stats: ReviewStats; pagination: { total: number } } }>(`/api/admin/reviews?${query.toString()}`);
    return result.data;
  } catch (error) {
    return fail(error, 'No se pudieron cargar las reseñas.');
  }
}

export async function moderateReview(id: string, input: { moderation_status?: ReviewStatus; moderation_reason?: string | null; business_response?: string | null }) {
  try {
    await apiFetch(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  } catch (error) {
    fail(error, 'No se pudo actualizar la reseña.');
  }
}

// ─── Lo que sigue en la web ────────────────────────────────────────────────

export const WEB_SECTIONS: { label: string; hint: string; path: string; icon: string }[] = [
  { label: 'Finanzas', hint: 'Gastos, nómina y rentabilidad', path: '/admin/finances', icon: 'cash-outline' },
  { label: 'Reportes', hint: 'Informes operativos', path: '/admin/reports', icon: 'document-text-outline' },
  { label: 'Analítica', hint: 'Análisis avanzado', path: '/admin/analytics', icon: 'analytics-outline' },
  { label: 'Sucursales', hint: 'Multi sucursal', path: '/admin/branches', icon: 'business-outline' },
  { label: 'Sitio web', hint: 'Tu tienda online', path: '/admin/website', icon: 'globe-outline' },
  { label: 'Suscripción', hint: 'Plan y facturación', path: '/admin/subscriptions', icon: 'card-outline' },
  { label: 'Seguridad', hint: 'Logs y auditoría', path: '/admin/security', icon: 'shield-checkmark-outline' },
  { label: 'Configuración', hint: 'Impuestos, moneda, módulos', path: '/admin/settings', icon: 'settings-outline' },
  { label: 'Datos del negocio', hint: 'Rubro, contacto y visibilidad', path: '/admin/onboarding', icon: 'storefront-outline' },
];
