export const ACTIVE_ORGANIZATION_COOKIE = 'active_organization_id'


// Public selector only. Every API/RPC must independently verify membership.
let browserOrganizationId: string | null = null
export function setBrowserOrganizationId(id: string | null) { browserOrganizationId = id }
export function getBrowserOrganizationId() { return browserOrganizationId }
