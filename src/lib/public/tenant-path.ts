import { headers } from 'next/headers'
export { prefixPublicTenantPath } from '@/lib/public/tenant-path-shared'

export async function getPublicTenantPathPrefix() {
  const headerStore = await headers()
  const slug = headerStore.get('x-tenant-slug')

  return slug ? `/${slug}` : ''
}
