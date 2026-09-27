import type { DashboardProfile, DashboardProfilePatch } from './dashboard-profile-contract'

type Fetcher = typeof fetch

type SaveResult = {
  profile: DashboardProfile
  partial: boolean
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>
}

export async function loadDashboardProfile(fetcher: Fetcher = fetch): Promise<DashboardProfile> {
  const response = await fetcher('/api/dashboard/profile', { cache: 'no-store' })
  const body = await responseJson(response)
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo cargar el perfil')
  return body.profile as DashboardProfile
}

export async function saveDashboardProfile(
  patch: DashboardProfilePatch,
  fetcher: Fetcher = fetch,
): Promise<SaveResult> {
  const response = await fetcher('/api/dashboard/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = await responseJson(response)
  if (!response.ok && response.status !== 207) {
    throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo guardar el perfil')
  }
  return {
    profile: body.profile as DashboardProfile,
    partial: body.partial === true,
  }
}
