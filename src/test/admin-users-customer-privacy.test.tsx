import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CONTACT_REVEAL_ACTION,
  isCustomerRole,
  maskCustomerContact,
  maskEmail,
  maskPhone,
} from '@/lib/admin/contact-privacy'
import { UsersRoleTree } from '@/components/admin/users/users-role-tree'
import { UsersTable } from '@/components/admin/users/users-table'
import type { SupabaseUser } from '@/hooks/use-users-supabase'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

/**
 * La lista mostraba el correo y el teléfono de cada cliente de la tienda a
 * cualquiera del equipo con acceso al panel.
 */
describe('contacto de los clientes', () => {
  it('el correo conserva el dominio y el teléfono los últimos tres dígitos', () => {
    expect(maskEmail('ana.gonzalez@gmail.com')).toBe('an•••@gmail.com')
    expect(maskEmail('jp@hca.com.py')).toBe('j•••@hca.com.py')
    expect(maskEmail('')).toBe('')
    expect(maskEmail('sin-arroba')).toBe('•••')
    expect(maskPhone('0985 796 523')).toBe('••• 523')
    expect(maskPhone('12')).toBe('•••')
    expect(maskPhone(null)).toBe('')
  })

  it('solo se tapa el contacto de los clientes, no el del equipo', () => {
    expect(isCustomerRole('cliente')).toBe(true)
    expect(isCustomerRole('customer')).toBe(true)
    expect(isCustomerRole('vendedor')).toBe(false)

    const cliente = maskCustomerContact({ role: 'cliente', email: 'ana@gmail.com', phone: '0985796523' })
    expect(cliente).toEqual({ role: 'cliente', email: 'an•••@gmail.com', phone: '••• 523', contactMasked: true })

    const vendedora = { role: 'vendedor', email: 'vende@hca.com.py', phone: '021555100' }
    expect(maskCustomerContact(vendedora)).toBe(vendedora)
  })

  it('la API tapa las listas y registra a quien pide ver un contacto', () => {
    const api = leer('src/app/api/admin/users/route.ts')
    expect(api).toContain('applyContactPrivacy(mappedUsers, revealId, context, supabaseAdmin)')
    expect(api).toContain(`action: ${'CONTACT_REVEAL_ACTION'}`)
    expect(CONTACT_REVEAL_ACTION).toBe('reveal_customer_contact')
    // El revelado es de a uno: solo el cliente pedido vuelve completo.
    expect(api).toContain("users.find((user) => user.id === revealId && isCustomerRole(user.role))")
  })

  it('la pantalla ofrece mostrarlo y avisa que queda registrado', () => {
    const tabla = leer('src/components/admin/users/users-table.tsx')
    expect(tabla).toContain('user.contactMasked && onRevealContact')
    expect(tabla).toContain('Mostrar')
    expect(leer('src/components/admin/users/user-management.tsx')).toContain('esa consulta queda registrada')
  })
})

describe('vista por rol', () => {
  const usuario = (id: string, name: string, role: string): SupabaseUser => ({
    id,
    name,
    email: `${id}@hca.com.py`,
    role,
    status: 'active',
    department: '',
    phone: '',
    permissions: [],
    lastLogin: null,
    createdAt: '2026-01-01T00:00:00Z',
    loginAttempts: 0,
    lastActivity: '2026-01-01T00:00:00Z',
    notes: '',
  } as unknown as SupabaseUser)

  /** Esta vista es del equipo: los clientes tienen su propia pestaña. */
  it('no arma un grupo de clientes, aunque la organización tenga muchos', () => {
    render(
      <UsersRoleTree
        users={[usuario('u1', 'Ana', 'vendedor')]}
        isLoading={false}
        countsByRole={{ vendedor: 1, cliente: 85 }}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )
    expect(screen.getByText('Vendedor')).toBeInTheDocument()
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument()
    expect(screen.queryByText('85')).not.toBeInTheDocument()
  })

  /** Quien no tiene rol caía en «Cliente» y figuraba como tal sin serlo. */
  it('quien no tiene rol aparece como «Sin rol asignado»', () => {
    render(
      <UsersRoleTree
        users={[usuario('u2', 'Beto', '')]}
        isLoading={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )
    expect(screen.getByText('Sin rol asignado')).toBeInTheDocument()
    expect(screen.getByText('Beto')).toBeInTheDocument()
  })
})

describe('última actividad de un cliente', () => {
  const cliente = (over: Partial<SupabaseUser> = {}): SupabaseUser => ({
    id: 'c1',
    name: 'Ana González',
    email: 'an•••@gmail.com',
    role: 'cliente',
    status: 'active',
    department: '',
    phone: '••• 523',
    permissions: [],
    lastLogin: null,
    createdAt: '2026-01-01T00:00:00Z',
    loginAttempts: 0,
    lastActivity: '2026-01-01T00:00:00Z',
    notes: '',
    contactMasked: true,
    ...over,
  } as unknown as SupabaseUser)

  const tabla = (user: SupabaseUser, activityColumn: 'login' | 'purchase') =>
    render(
      <UsersTable
        users={[user]}
        isLoading={false}
        page={1}
        pageSize={10}
        totalCount={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onView={vi.fn()}
        onRevealContact={vi.fn()}
        activityColumn={activityColumn}
      />,
    )

  /** La columna decía «último acceso» y en clientes interesa la compra. */
  it('en clientes la columna es la última compra', () => {
    tabla(cliente({ lastPurchase: new Date(Date.now() - 2 * 86_400_000).toISOString() }), 'purchase')
    expect(screen.getByRole('columnheader', { name: /Última compra/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Último acceso/ })).not.toBeInTheDocument()
  })

  it('un cliente que nunca compró lo dice, sin inventar una fecha', () => {
    tabla(cliente({ lastPurchase: null }), 'purchase')
    expect(screen.getByText('Sin compras')).toBeInTheDocument()
  })

  /** Antes, sin acceso real se mostraba la fecha en que se editó el perfil. */
  it('quien nunca inició sesión figura como «Nunca», no con la fecha del perfil', () => {
    tabla(cliente({ lastLogin: null }), 'login')
    expect(screen.getByRole('columnheader', { name: /Último acceso/ })).toBeInTheDocument()
    expect(screen.getByText('Nunca')).toBeInTheDocument()
    expect(leer('src/app/api/admin/users/route.ts')).toContain('last_sign_in_at: lastSignInAt ?? null')
  })

  it('la última compra sale de ventas y pedidos, sin contar lo anulado', () => {
    const api = leer('src/app/api/admin/users/route.ts')
    expect(api).toContain('fetchLastPurchases(supabaseAdmin, context.organizationId, profileIds)')
    expect(api).toContain('consider(sales.data, (status) => !isCompletedSaleStatus(status))')
    expect(api).toContain("consider(orders.data, (status) => normalizeOrderStatus(status) === 'CANCELLED')")
  })
})
