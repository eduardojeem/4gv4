type Profile = { status?: string | null; role?: string | null } | null
type Role = { is_active?: boolean | null; role?: string | null } | null
/** Only trusted database records establish access. A customer session grants no staff permissions. */
export function mobileLoginAccess(profile: Profile, role: Role, staffMemberships: number): 'ok' | 'customer' | 'inactive' | 'not_staff' {
  if (profile?.status === 'inactive' || profile?.status === 'suspended' || role?.is_active === false) return 'inactive'
  if (staffMemberships > 0) return 'ok'
  const customerRoles = ['cliente', 'customer']
  if (profile?.status === 'active' && role?.is_active === true
    && customerRoles.includes(profile.role ?? '') && customerRoles.includes(role.role ?? '')) return 'customer'
  return 'not_staff'
}