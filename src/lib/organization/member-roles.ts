/**
 * Quien es parte del equipo y quien es un cliente.
 *
 * `organization_members` guarda las dos cosas en la misma tabla: el tecnico que
 * repara y el cliente que se registro solo desde la tienda publica. La pantalla
 * los listaba juntos bajo «Colaboradores de la Empresa» y mostraba el nombre
 * crudo de la columna —`owner`, `seller`, `customer`— como si fuera un rotulo.
 */

export const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Superadministrador',
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Encargado',
  seller: 'Vendedor',
  vendedor: 'Vendedor',
  cashier: 'Cajero',
  technician: 'Técnico',
  tecnico: 'Técnico',
  customer: 'Cliente',
  cliente: 'Cliente',
}

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  invited: 'Invitado',
  suspended: 'Suspendido',
}

/** Que puede hacer cada rol, en una frase. Un rotulo solo no dice el alcance. */
export const ORGANIZATION_ROLE_HINTS: Record<string, string> = {
  owner: 'Dueño de la cuenta: puede todo, incluido cerrar la organización',
  admin: 'Configura el sistema y administra al resto del equipo',
  manager: 'Supervisa la operación de su sucursal',
  seller: 'Vende en el punto de venta y atiende clientes',
  cashier: 'Opera la caja y cobra',
  technician: 'Recibe y repara equipos en el taller',
  customer: 'Se registró desde la tienda pública: solo compra',
}

export function roleLabel(role: unknown): string {
  const clave = String(role ?? '').toLowerCase().trim()
  return ORGANIZATION_ROLE_LABELS[clave] ?? (clave ? clave : 'Sin rol')
}

export function memberStatusLabel(status: unknown): string {
  const clave = String(status ?? '').toLowerCase().trim()
  return MEMBER_STATUS_LABELS[clave] ?? (clave ? clave : 'Sin estado')
}

/**
 * Un miembro es del equipo cuando su rol no es `customer`. Es exactamente el
 * criterio de `countStaffMembers` en subscription-service, que decide cuantas
 * butacas del plan se consumen: si aca se usara otro, la pantalla y el limite
 * dirian cosas distintas.
 *
 * Una fila sin rol cuenta como equipo: `neq('role', 'customer')` la descarta en
 * SQL porque `NULL <> 'customer'` es NULL, pero es un miembro real que alguien
 * cargo mal, no un cliente.
 */
export function isStaffRole(role: unknown): boolean {
  return String(role ?? '').toLowerCase().trim() !== 'customer'
}

export interface MemberLike {
  role?: string | null
  status?: string | null
}

export interface MemberPartition<T> {
  staff: T[]
  customers: T[]
  /** Del equipo, cuantos ocupan butaca del plan: activos. */
  staffActive: number
  staffInvited: number
  staffSuspended: number
  /** Filas de equipo sin rol cargado: hay que corregirlas. */
  staffWithoutRole: number
}

export function partitionMembers<T extends MemberLike>(members: T[]): MemberPartition<T> {
  const staff: T[] = []
  const customers: T[] = []
  let staffActive = 0
  let staffInvited = 0
  let staffSuspended = 0
  let staffWithoutRole = 0

  for (const member of members) {
    if (!isStaffRole(member.role)) {
      customers.push(member)
      continue
    }

    staff.push(member)

    if (!member.role) staffWithoutRole += 1

    switch (String(member.status ?? '').toLowerCase()) {
      case 'active': staffActive += 1; break
      case 'invited': staffInvited += 1; break
      case 'suspended': staffSuspended += 1; break
    }
  }

  return { staff, customers, staffActive, staffInvited, staffSuspended, staffWithoutRole }
}

/** Orden de jerarquia, para que el propietario no quede sepultado en la lista. */
const ORDEN_ROL = ['owner', 'admin', 'manager', 'cashier', 'seller', 'technician']

export function sortStaff<T extends MemberLike>(staff: T[]): T[] {
  return [...staff].sort((a, b) => {
    const ia = ORDEN_ROL.indexOf(String(a.role ?? '').toLowerCase())
    const ib = ORDEN_ROL.indexOf(String(b.role ?? '').toLowerCase())
    return (ia === -1 ? ORDEN_ROL.length : ia) - (ib === -1 ? ORDEN_ROL.length : ib)
  })
}
