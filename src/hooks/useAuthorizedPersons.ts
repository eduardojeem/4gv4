"use client"

import useSWR, { mutate as globalMutate } from 'swr'
import customerService from '@/services/customer-service'

type AuthorizedPerson = {
  id: string
  profile_id: string
  full_name: string
  document_number: string
  relationship?: string | null
  phone?: string | null
  is_active: boolean
  created_at: string
}

export function useAuthorizedPersons(profileId: string | null, enabled: boolean) {
  const key = enabled && profileId ? ['authorized_persons', profileId] : null
  const { data, error, mutate, isLoading } = useSWR(
    key,
    async () => {
      const resp = await customerService.getCustomerAuthorizedPersons(profileId as string)
      if (!resp.success) throw new Error(resp.error || 'Error')
      return (resp.data || []) as AuthorizedPerson[]
    },
    { revalidateOnFocus: false, dedupingInterval: 4000 }
  )

  // Sin Realtime: authorized_persons no está en la publicación
  // supabase_realtime; los cambios propios se reflejan con mutate().
  return { data: data || [], error, isLoading, mutate }
}

export async function prefetchAuthorizedPersons(profileId: string) {
  try {
    const resp = await customerService.getCustomerAuthorizedPersons(profileId)
    if (resp.success) {
      await globalMutate(['authorized_persons', profileId], resp.data || [], false)
    }
  } catch {}
}
