import type { Ionicons } from '@expo/vector-icons';

import { ApiError, apiFetch } from './api';

/**
 * Reparaciones en la app: las mismas APIs que la sección de la web
 * (GET /api/repairs y PATCH /api/repairs/:id/status), con sus reglas de
 * permisos, sucursal y transiciones de estado.
 */

export type RepairStatus = 'recibido' | 'diagnostico' | 'reparacion' | 'pausado' | 'listo' | 'entregado' | 'cancelado';

export type Repair = {
  id: string;
  ticket_number?: string | null;
  status: RepairStatus;
  priority?: string | null;
  device_type?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  imei?: string | null;
  serial_number?: string | null;
  problem_description?: string | null;
  diagnosis?: string | null;
  estimated_cost?: number | null;
  final_cost?: number | null;
  paid_amount?: number | null;
  labor_cost?: number | null;
  discount_amount?: number | null;
  warranty_months?: number | null;
  parts?: { id: string; part_name: string; quantity: number; unit_price: number; unit_cost?: number | null; product_id?: string | null; part_number?: string | null; supplier?: string | null; line_type?: string | null; discount_amount?: number | null; tax_rate?: number | null }[] | null;
  estimated_completion?: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  delivered_at?: string | null;
  technician_id?: string | null;
  delivery_outcome?: 'repaired' | 'unrepairable' | 'withdrawn' | null;
  qualityCheck?: { result?: string | null } | { result?: string | null }[] | null;
  customer?: { id: string; name?: string | null; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null; customer_type?: string | null } | null;
  technician?: { id: string; full_name?: string | null } | null;
  images?: { id: string; image_url: string; description?: string | null }[] | null;
  payments?: { id: string; amount?: number | null; payment_method?: string | null; created_at?: string | null }[] | null;
};

type IconName = keyof typeof Ionicons.glyphMap;

/** Mismos nombres y colores que REPAIR_STATUS_CONFIG de la web. */
export const STATUS: Record<RepairStatus, { label: string; color: string; icon: IconName }> = {
  recibido: { label: 'Recibido', color: '#2563EB', icon: 'cube-outline' },
  diagnostico: { label: 'Diagnóstico', color: '#7C3AED', icon: 'time-outline' },
  reparacion: { label: 'En reparación', color: '#D97706', icon: 'construct-outline' },
  pausado: { label: 'Pausado', color: '#CA8A04', icon: 'pause-circle-outline' },
  listo: { label: 'Listo para retirar', color: '#16A34A', icon: 'checkmark-circle-outline' },
  entregado: { label: 'Entregado', color: '#64748B', icon: 'bag-check-outline' },
  cancelado: { label: 'Cancelado', color: '#DC2626', icon: 'close-circle-outline' },
};

/** Las mismas transiciones que lib/repairs/state-machine.ts. La entrega va por su propio flujo. */
export const NEXT_STATUSES: Record<RepairStatus, RepairStatus[]> = {
  recibido: ['diagnostico', 'cancelado'],
  diagnostico: ['reparacion', 'pausado', 'cancelado'],
  reparacion: ['listo', 'pausado', 'cancelado'],
  pausado: ['diagnostico', 'reparacion'],
  listo: ['reparacion'],
  entregado: [],
  cancelado: ['recibido'],
};

export const PRIORITY: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgente', color: '#DC2626' },
  medium: { label: 'Normal', color: '#64748B' },
  low: { label: 'Baja', color: '#94A3B8' },
};

export const DEVICE_ICONS: Record<string, IconName> = {
  smartphone: 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  laptop: 'laptop-outline',
  desktop: 'desktop-outline',
  accessory: 'headset-outline',
  other: 'hardware-chip-outline',
};

export const TIMELINE: RepairStatus[] = ['recibido', 'diagnostico', 'reparacion', 'listo', 'entregado'];

export type RepairFilter = 'active' | RepairStatus | 'all';

export const FILTERS: { key: RepairFilter; label: string }[] = [
  { key: 'active', label: 'En curso' },
  { key: 'recibido', label: 'Recibido' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'reparacion', label: 'En reparación' },
  { key: 'pausado', label: 'Pausado' },
  { key: 'listo', label: 'Listos' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'cancelado', label: 'Cancelados' },
  { key: 'all', label: 'Todas' },
];

export type RepairPage = { repairs: Repair[]; pagination: { page: number; total: number; totalPages: number } };

export function fetchRepairs({ page, filter, search }: { page: number; filter: RepairFilter; search: string }) {
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (filter === 'active') params.set('chargeable', 'true');
  else if (filter !== 'all') params.set('status', filter);
  if (search.trim()) params.set('search', search.trim());
  return apiFetch<RepairPage>(`/api/repairs?${params.toString()}`);
}

const STATUS_ERRORS: Record<string, string> = {
  forbidden: 'Tu usuario no puede cambiar el estado de las reparaciones.',
  repair_not_found: 'La reparación ya no existe o es de otra sucursal.',
  organization_required: 'Tu usuario no pertenece a un comercio activo.',
};

export async function changeRepairStatus(id: string, stage: RepairStatus, note?: string) {
  try {
    const result = await apiFetch<{ ok: boolean; repair: Repair }>(`/api/repairs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, note: note?.trim() || undefined }),
    });
    return result.repair;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error(STATUS_ERRORS[message] ?? (message || 'No se pudo cambiar el estado.'));
  }
}

/**
 * La lista ya trae todo lo que muestra el detalle: se guarda acá para abrirlo
 * al instante sin volver a pedirlo.
 */
const cache = new Map<string, Repair>();
export const rememberRepairs = (repairs: Repair[]) => repairs.forEach((repair) => cache.set(repair.id, repair));
export const cachedRepair = (id: string) => cache.get(id);
const listeners = new Set<(repair: Repair) => void>();
export function updateCachedRepair(repair: Repair) {
  cache.set(repair.id, repair);
  listeners.forEach((listener) => listener(repair));
}
export function onRepairUpdated(listener: (repair: Repair) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Resultado de una orden cerrada, con la misma regla que la tarjeta de la web:
 * un equipo entregado puede haberse retirado sin reparar o no tener solución.
 */
export function repairOutcome(repair: Repair): { label: string; color: string } | null {
  const check = Array.isArray(repair.qualityCheck) ? repair.qualityCheck[0] : repair.qualityCheck;
  const result = check?.result ?? null;
  if (repair.delivery_outcome === 'unrepairable' || result === 'unrepairable') return { label: 'Sin solución', color: '#E11D48' };
  if (repair.delivery_outcome === 'withdrawn' || result === 'withdrawn') return { label: 'Retirado sin reparar', color: '#D97706' };
  return null;
}

export const customerName = (repair: Repair) => {
  const customer = repair.customer;
  if (!customer) return 'Sin cliente';
  return customer.name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre';
};

export const deviceName = (repair: Repair) =>
  [repair.device_brand, repair.device_model].filter(Boolean).join(' ').trim() || repair.device_type || 'Equipo';

export const ticketOf = (repair: Repair) => repair.ticket_number || `#${repair.id.slice(0, 8).toUpperCase()}`;

/** Total presupuestado (final si ya se cerró), lo pagado y lo que falta. */
export function money(repair: Repair) {
  const total = Number(repair.final_cost ?? repair.estimated_cost ?? 0) || 0;
  const paymentsSum = (repair.payments ?? []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const paid = Number(repair.paid_amount ?? paymentsSum) || 0;
  return { total, paid, balance: Math.max(0, total - paid), quoted: total > 0 };
}

export function shortDate(iso?: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

// ─── Alta de reparaciones ──────────────────────────────────────────────────

export type RepairCustomer = {
  id: string;
  name: string;
  customer_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  alternate_phone_label?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  ruc?: string | null;
  customer_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export const isWholesale = (customer: Pick<RepairCustomer, 'customer_type'>) =>
  ['wholesale', 'mayorista'].includes(String(customer.customer_type ?? '').toLowerCase());

export type NewCustomerInput = {
  name: string;
  ruc?: string;
  phone?: string;
  alternatePhone?: string;
  alternatePhoneLabel?: string;
  email?: string;
  city?: string;
  companyName?: string;
};

export type CustomerDuplicate = {
  field: string;
  value: string;
  customerId: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  ruc?: string | null;
};

/** El servidor no deja repetir teléfono, email ni CI/RUC: devuelve con quién coincide. */
export class DuplicateCustomerError extends Error {
  constructor(message: string, readonly duplicates: CustomerDuplicate[]) {
    super(message);
  }
}
export type Technician = { id: string; name: string | null; specialty?: string | null };

export const DEVICE_TYPES: { key: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other'; label: string }[] = [
  { key: 'smartphone', label: 'Celular' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'laptop', label: 'Notebook' },
  { key: 'desktop', label: 'PC' },
  { key: 'accessory', label: 'Accesorio' },
  { key: 'other', label: 'Otro' },
];

export const ACCESS_TYPES: { key: 'none' | 'pin' | 'pattern' | 'password'; label: string }[] = [
  { key: 'none', label: 'Sin bloqueo' },
  { key: 'pin', label: 'PIN' },
  { key: 'pattern', label: 'Patrón' },
  { key: 'password', label: 'Contraseña' },
];

export type NewRepairInput = {
  customer_id: string;
  device_type: (typeof DEVICE_TYPES)[number]['key'];
  device_brand: string;
  device_model: string;
  imei?: string;
  serial_number?: string;
  problem_description: string;
  diagnosis?: string;
  access_type: (typeof ACCESS_TYPES)[number]['key'];
  access_password?: string;
  priority: 'low' | 'medium' | 'high';
  estimated_cost: number;
  technician_id?: string | null;
  labor_cost?: number;
  parts?: CostLine[];
};

export async function searchRepairCustomers(q: string) {
  const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const result = await apiFetch<{ success: boolean; data: RepairCustomer[] }>(`/api/repairs/customers${params}`);
  return result.data ?? [];
}

export async function createRepairCustomer(input: NewCustomerInput) {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const [first, ...rest] = name.split(' ');
  try {
    const result = await apiFetch<{ success: boolean; data: RepairCustomer }>('/api/repairs/customers', {
      method: 'POST',
      body: JSON.stringify({
        name,
        first_name: input.companyName ? null : first || null,
        last_name: input.companyName ? null : rest.join(' ') || null,
        company_name: clean(input.companyName),
        ruc: clean(input.ruc),
        phone: clean(input.phone),
        alternate_phone: clean(input.alternatePhone),
        alternate_phone_label: clean(input.alternatePhone) ? clean(input.alternatePhoneLabel) : null,
        email: clean(input.email) ?? '',
        city: clean(input.city),
        customer_type: input.companyName ? 'empresa' : null,
      }),
    });
    return result.data;
  } catch (error) {
    if (error instanceof ApiError && error.body?.code === 'CUSTOMER_DUPLICATE') {
      throw new DuplicateCustomerError(error.message, (error.body.duplicates as CustomerDuplicate[]) ?? []);
    }
    throw error;
  }
}

/** Busca un cliente por id (para «usar el existente» cuando el alta choca con un duplicado). */
export async function findCustomerById(id: string, hint: string) {
  const rows = await searchRepairCustomers(hint);
  return rows.find((row) => row.id === id) ?? null;
}

export async function fetchTechnicians() {
  const result = await apiFetch<{ technicians?: Technician[] }>('/api/repairs/technicians-stats');
  return result.technicians ?? [];
}

/**
 * Clave para que un toque doble (o un reintento por mala señal) no cree dos
 * órdenes: el servidor devuelve la misma si ya la recibió.
 */
export function newIdempotencyKey() {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

export async function createRepair(input: NewRepairInput, idempotencyKey: string) {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);
  const result = await apiFetch<{ repair: Repair; replayed: boolean }>('/api/repairs', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      customer_id: input.customer_id,
      device_type: input.device_type,
      device_brand: input.device_brand.trim(),
      device_model: input.device_model.trim(),
      imei: clean(input.imei),
      serial_number: clean(input.serial_number),
      problem_description: input.problem_description.trim(),
      diagnosis: clean(input.diagnosis),
      access_type: input.access_type,
      access_password: input.access_type === 'none' ? null : clean(input.access_password),
      priority: input.priority,
      estimated_cost: input.estimated_cost,
      labor_cost: input.labor_cost ?? 0,
      technician_id: input.technician_id || null,
      // Presupuesto armado al recibir el equipo: los del inventario reservan stock.
      parts: (input.parts ?? []).map((part) => ({
        part_name: part.name.trim(),
        unit_price: part.unitPrice,
        ...(part.unitCost != null ? { unit_cost: part.unitCost } : {}),
        quantity: part.quantity,
        product_id: part.productId ?? null,
        part_number: part.partNumber ?? null,
        line_type: part.lineType,
      })),
    }),
  });
  return result.repair;
}

// ─── Verificación técnica ──────────────────────────────────────────────────

export type QualityResult = 'passed' | 'failed' | 'unrepairable' | 'withdrawn';
export type QualityChecklist = {
  powersOn: boolean;
  reportedIssueResolved: boolean;
  basicFunctions: boolean;
  physicalCondition: boolean;
  accessoriesVerified: boolean;
};

/** Mismos textos, sugerencias y reglas que RepairQualityCheckDialog de la web. */
export const QUALITY_CHECKS: { key: keyof QualityChecklist; label: string }[] = [
  { key: 'powersOn', label: 'Enciende correctamente' },
  { key: 'reportedIssueResolved', label: 'Falla original solucionada' },
  { key: 'basicFunctions', label: 'Funciones básicas probadas' },
  { key: 'physicalCondition', label: 'Estado físico verificado' },
  { key: 'accessoriesVerified', label: 'Accesorios verificados' },
];

export const QUALITY_RESULTS: { key: QualityResult; label: string; color: string; icon: IconName; submit: string }[] = [
  { key: 'passed', label: 'Funciona correctamente', color: '#16A34A', icon: 'checkmark-circle-outline', submit: 'Aprobar y marcar listo' },
  { key: 'failed', label: 'Falló la prueba final', color: '#E11D48', icon: 'warning-outline', submit: 'Registrar falla y volver a reparación' },
  { key: 'unrepairable', label: 'No fue posible reparar', color: '#D97706', icon: 'construct-outline', submit: 'Registrar como listo para retiro' },
  { key: 'withdrawn', label: 'Retiro sin reparar', color: '#D97706', icon: 'exit-outline', submit: 'Registrar como listo para retiro' },
];

export const QUALITY_SUGGESTIONS: Record<QualityResult, string[]> = {
  passed: ['Equipo probado al 100% y operativo', 'Batería cargada y funciones probadas', 'Limpieza interna y externa realizada', 'Se recomienda protector y funda al cliente'],
  failed: ['No retiene carga de batería / no carga', 'Falla táctil intermitente / pantalla parpadea', 'Reinicio inesperado en uso', 'Cámara o micrófono con distorsión o sin respuesta', 'Falla de conectividad Wi-Fi o señal', 'Audio distorsionado en altavoz o auricular'],
  unrepairable: ['Daño severo en placa madre sin reparación viable', 'Repuesto descontinuado o sin stock disponible', 'Sulfatación avanzada / corrosión por líquidos', 'Cortocircuito en CPU o memoria principal', 'Costo de repuestos excede el valor comercial'],
  withdrawn: ['Cliente retira sin autorizar presupuesto', 'Cliente necesita el equipo con urgencia sin reparar', 'Presupuesto rechazado por el cliente', 'Sin respuesta del cliente para autorizar trabajo', 'Retiro para evaluación en otro servicio técnico'],
};

/** Roles que la API deja verificar (owner, admin, manager, technician). */
export const QUALITY_ROLES = ['owner', 'admin', 'manager', 'technician'];

export async function submitQualityCheck(id: string, input: { result: QualityResult; checklist: QualityChecklist; note: string }) {
  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${id}/quality-check`, {
    method: 'POST',
    body: JSON.stringify({ result: input.result, checklist: input.checklist, note: input.note.trim() || undefined }),
  });
  return result.repair;
}

// ─── Entrega ───────────────────────────────────────────────────────────────

export type DeliveryOutcome = 'repaired' | 'unrepairable' | 'withdrawn';
export type PayMethod = 'cash' | 'card' | 'transfer';

export const PAY_METHODS: { key: PayMethod; label: string; icon: IconName }[] = [
  { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'card', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
];

/**
 * Qué entrega corresponde según la verificación técnica (la misma regla que el
 * servidor): sin verificación o con prueba fallida no se puede entregar.
 */
export function deliveryOutcomeFor(repair: Repair): DeliveryOutcome | null {
  const check = Array.isArray(repair.qualityCheck) ? repair.qualityCheck[0] : repair.qualityCheck;
  const result = check?.result;
  if (result === 'passed') return 'repaired';
  if (result === 'unrepairable' || result === 'withdrawn') return result;
  return null;
}

export type RepairedDelivery = {
  outcome: 'repaired';
  note?: string;
  allowOutstandingBalance: boolean;
  payment?: { method: PayMethod; amount: number; reference?: string };
};

export type UnrepairedDelivery = {
  outcome: 'unrepairable' | 'withdrawn';
  chargeAmount: number;
  settlement:
    | { kind: 'none' }
    | { kind: 'payment'; method: PayMethod; amount: number; reference?: string }
    | { kind: 'outstanding' }
    | { kind: 'refund'; method: 'cash' }
    | { kind: 'store_credit' };
  note?: string;
};

export async function deliverRepair(id: string, input: RepairedDelivery | UnrepairedDelivery, idempotencyKey: string) {
  const note = input.note?.trim() || undefined;
  const body =
    input.outcome === 'repaired'
      ? {
          outcome: 'repaired',
          note,
          allowOutstandingBalance: input.allowOutstandingBalance,
          idempotencyKey,
          ...(input.payment
            ? {
                payment: {
                  method: input.payment.method,
                  amount: input.payment.amount,
                  reference: input.payment.reference?.trim() || undefined,
                  idempotencyKey: `${idempotencyKey}-pay`,
                },
              }
            : {}),
        }
      : {
          outcome: input.outcome,
          // Sin cargo, o un cargo por la revisión (mano de obra), como el panel de la web.
          charge: input.chargeAmount > 0 ? { mode: 'labor', laborAmount: input.chargeAmount } : { mode: 'none' },
          parts: [],
          settlement:
            input.settlement.kind === 'payment'
              ? { ...input.settlement, reference: input.settlement.reference?.trim() || undefined }
              : input.settlement,
          note,
          idempotencyKey,
        };
  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${id}/delivery`, { method: 'POST', body: JSON.stringify(body) });
  return result.repair;
}

// ─── Edición, costos y pagos ───────────────────────────────────────────────

export type RepairEdit = {
  deviceType: NewRepairInput['device_type'];
  brand: string;
  model: string;
  issue: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  technicianId: string | null;
  warrantyMonths: number;
};

/** PATCH /api/repairs/:id con los mismos nombres de campo que usa la web. */
export async function updateRepair(id: string, edit: RepairEdit) {
  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      deviceType: edit.deviceType,
      brand: edit.brand.trim(),
      model: edit.model.trim(),
      issue: edit.issue.trim(),
      description: edit.description.trim() || null,
      priority: edit.priority,
      warrantyMonths: edit.warrantyMonths,
      // La API rechaza un técnico vacío: solo se manda si se eligió uno.
      ...(edit.technicianId ? { technician_id: edit.technicianId } : {}),
    }),
  });
  return result.repair;
}

export type CostLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  productId?: string | null;
  partNumber?: string | null;
  supplier?: string | null;
  unitCost?: number | null;
  /** Descuento de la línea (Gs.) e IVA: los guarda «Costos», como la web. */
  discountAmount?: number;
  taxRate?: 0 | 5 | 10;
  lineType: 'charged_part' | 'service' | 'included_material';
};

/**
 * Guarda una revisión de costos (mano de obra + repuestos − descuento), como
 * «Costos» en la web: queda en el historial y recalcula el total y el saldo.
 */
export async function saveRepairCosts(
  id: string,
  input: { laborAmount: number; parts: CostLine[]; discountAmount: number; additionalCharges?: number; reason?: string },
  idempotencyKey: string
) {
  const result = await apiFetch<{ repair: Repair; summary?: unknown }>(`/api/repairs/${id}/costs`, {
    method: 'POST',
    body: JSON.stringify({
      laborAmount: input.laborAmount,
      discountAmount: input.discountAmount,
      additionalCharges: input.additionalCharges ?? 0,
      overrideReason: input.reason?.trim() || null,
      parts: input.parts.map((part) => ({
        name: part.name.trim(),
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        productId: part.productId ?? null,
        partNumber: part.partNumber ?? null,
        supplier: part.supplier ?? null,
        ...(part.unitCost != null ? { unitCost: part.unitCost } : {}),
        discountAmount: part.discountAmount ?? 0,
        ...(part.taxRate != null ? { taxRate: part.taxRate } : {}),
        lineType: part.lineType,
      })),
      idempotencyKey,
    }),
  });
  return result.repair;
}

/** Cobro del saldo o, si todavía no hay precio, anticipo. Igual que la web. */
export async function registerRepairPayment(
  id: string,
  input: { method: PayMethod; amount: number; reference?: string; note?: string; purpose: 'payment' | 'deposit' },
  idempotencyKey: string
) {
  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify({
      method: input.method,
      amount: input.amount,
      reference: input.reference?.trim() || undefined,
      note: input.note?.trim() || undefined,
      purpose: input.purpose,
      idempotencyKey,
    }),
  });
  return result.repair;
}

// ─── Catálogos para cargar más rápido ──────────────────────────────────────

/** Los mismos problemas frecuentes que el formulario de la web. */
export const FREQUENT_ISSUES: { label: string; issue: string; icon: IconName }[] = [
  { label: 'Pantalla / Módulo', issue: 'Cambio de Pantalla / Módulo Táctil', icon: 'phone-portrait-outline' },
  { label: 'Batería', issue: 'Cambio de Batería (No retiene carga)', icon: 'battery-dead-outline' },
  { label: 'Pin de carga', issue: 'Cambio de Pin de Carga (No carga)', icon: 'flash-outline' },
  { label: 'Mantenimiento', issue: 'Mantenimiento preventivo y limpieza general', icon: 'sparkles-outline' },
  { label: 'Software', issue: 'Falla de Software / Reinstalación de sistema', icon: 'code-slash-outline' },
  { label: 'Cámara', issue: 'Falla de Cámara / Lente roto', icon: 'camera-outline' },
  { label: 'No enciende', issue: 'Equipo no enciende / Revisión de placa', icon: 'power-outline' },
];

export const KNOWN_BRANDS = ['Samsung', 'Apple', 'Motorola', 'Xiaomi', 'Huawei', 'Tecno', 'Infinix', 'Oppo', 'Realme', 'Nokia', 'LG', 'Lenovo', 'HP', 'Dell', 'Asus', 'Acer'];

export type DeviceOptions = { brands: string[]; modelsByBrand: Record<string, string[]> };

/** Marcas y modelos que el comercio ya cargó (y el catálogo global). Si falla, se usan las conocidas. */
export async function fetchDeviceOptions(): Promise<DeviceOptions> {
  try {
    const result = await apiFetch<{ success: boolean; data?: DeviceOptions }>('/api/products/device-options');
    if (result.data?.brands?.length) return { brands: result.data.brands, modelsByBrand: result.data.modelsByBrand ?? {} };
  } catch {
    // Sin módulo de inventario o sin permiso: alcanza con las marcas conocidas.
  }
  return { brands: KNOWN_BRANDS, modelsByBrand: {} };
}

export type InventoryItem = {
  productId: string;
  sku: string;
  name: string;
  availableStock: number | null;
  unitCost: number;
  unitPrice: number;
  retailPrice?: number;
  wholesalePriceApplied: boolean;
  wholesalePriceFallback?: boolean;
  /** Costo del material que trae un servicio: se agrega como «Material incluido». */
  includedMaterialCost?: number;
  taxRate?: 0 | 5 | 10;
  lineType: 'service' | 'charged_part';
};

/** Repuestos y servicios del inventario, con stock de la sucursal y el precio que corresponde al cliente. */
export async function searchInventory(q: string, repairId?: string) {
  const params = new URLSearchParams({ q: q.trim() });
  if (repairId) params.set('repairId', repairId);
  const result = await apiFetch<{ items: InventoryItem[] }>(`/api/repairs/inventory/search?${params.toString()}`);
  return result.items ?? [];
}

export const lineFromInventory = (item: InventoryItem): CostLine => ({
  name: item.name,
  quantity: 1,
  unitPrice: item.unitPrice,
  unitCost: item.unitCost,
  productId: item.productId,
  partNumber: item.sku || null,
  supplier: 'Inventario local',
  discountAmount: 0,
  taxRate: item.taxRate ?? 10,
  lineType: item.lineType,
});

export type CostRevision = {
  id: string;
  revision_number: number;
  final_total: number;
  labor_amount: number;
  parts_subtotal: number;
  services_subtotal?: number | null;
  discount_amount: number;
  additional_charges: number;
  reason?: string | null;
  actor_name?: string | null;
  created_at: string;
};

/** Historial de precios: cada vez que se guardaron los costos (la misma lista que la web). */
export async function fetchCostHistory(id: string) {
  const result = await apiFetch<{ revisions: CostRevision[] }>(`/api/repairs/${id}/costs`);
  return result.revisions ?? [];
}
