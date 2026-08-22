'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { z } from 'zod'
import { logAndTranslateError } from '@/lib/error-translator'

import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileStats } from '@/components/profile/profile-stats'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileQuickActions } from '@/components/profile/profile-quick-actions'
import { ProfileActivity } from '@/components/profile/profile-activity'
import { ProfileOrders, type ProfileOrder } from '@/components/profile/profile-orders'
import { ProfileAccountSummary } from '@/components/profile/profile-account-summary'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import type { CustomerAccountSummary } from '@/lib/profile/customer-account-summary'
import { PublicStoreCredit } from '@/components/public/store-credit/PublicStoreCredit'

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'El telefono debe ser valido').optional().or(z.literal('')),
  avatarUrl: z.string().optional(),
  location: z.string().optional()
})

type ProfileData = z.infer<typeof profileSchema> & { email: string; createdAt?: string; role?: string }

interface ProfileClientProps {
  initialData: ProfileData
  userId: string
  tenantPrefix: string
  stats: { totalRepairs: number; activeRepairs: number; readyRepairs: number; deliveredRepairs: number; totalOrders: number }
  accountSummary: CustomerAccountSummary
  recentRepairs: Array<{
    id: string
    ticket_number?: string | null
    brand?: string
    model?: string
    device?: string
    status: string
    created_at: string
    final_cost?: number | null
    estimated_cost?: number | null
    paid_amount?: number | null
    payment_status?: string | null
  }>
  recentOrders: ProfileOrder[]
}

export function ProfileClient({
  initialData,
  userId,
  tenantPrefix,
  stats,
  accountSummary,
  recentRepairs,
  recentOrders
}: ProfileClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>(initialData)
  const [initialProfile, setInitialProfile] = useState<ProfileData>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isDirty = useMemo(() => {
    return JSON.stringify(profile) !== JSON.stringify(initialProfile)
  }, [profile, initialProfile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    try {
      profileSchema.parse(profile)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => { if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message })
        setErrors(fieldErrors)
        toast.error('Por favor corrige los errores en el formulario')
      }
      return
    }
    setLoading(true)
    try {
      const normalizedProfile = {
        name: profile.name.trim(),
        phone: profile.phone?.trim() || '',
        avatarUrl: profile.avatarUrl?.trim() || '',
        location: profile.location?.trim() || '',
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: profile.email,
          full_name: normalizedProfile.name,
          phone: normalizedProfile.phone,
          avatar_url: normalizedProfile.avatarUrl,
          location: normalizedProfile.location,
          updated_at: new Date().toISOString(),
        })

      if (profileError) throw profileError

      supabase.auth.updateUser({
        data: {
          full_name: normalizedProfile.name,
          phone: normalizedProfile.phone,
          avatar_url: normalizedProfile.avatarUrl,
        },
      }).catch(error => {
        console.warn('Error en llamada a updateUser:', error)
      })

      const updatedProfile = {
        ...profile,
        name: normalizedProfile.name,
        phone: normalizedProfile.phone,
        avatarUrl: normalizedProfile.avatarUrl,
        location: normalizedProfile.location,
      }

      toast.success('Perfil actualizado correctamente')
      setProfile(updatedProfile)
      setInitialProfile(updatedProfile)
      router.refresh()
    } catch (error) {
      toast.error(logAndTranslateError(error, 'UpdateProfile'))
    } finally { setLoading(false) }
  }

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); toast.success('Sesion cerrada'); router.push(tenantPrefix ? `${tenantPrefix}/inicio` : '/login') }
    catch { toast.error('Error al cerrar sesion') }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <ProfileHeader
        name={profile.name}
        email={profile.email}
        role={profile.role || 'cliente'}
        createdAt={profile.createdAt || ''}
        avatarUrl={profile.avatarUrl}
        phone={profile.phone}
        userId={userId}
        onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <ProfileStats {...stats} />
        </div>

        <div className="mb-8">
          <ProfileAccountSummary summary={accountSummary} tenantPrefix={tenantPrefix} />
        </div>

        <div className="mb-8">
          <PublicStoreCredit
            authenticated
            organizationSlug={tenantPrefix.replace(/^\//, '') || null}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <ProfileForm
              name={profile.name}
              phone={profile.phone || ''}
              email={profile.email}
              location={profile.location || ''}
              errors={errors}
              isDirty={isDirty}
              loading={loading}
              onNameChange={(v) => setProfile(p => ({ ...p, name: v }))}
              onPhoneChange={(v) => setProfile(p => ({ ...p, phone: v }))}
              onLocationChange={(v) => setProfile(p => ({ ...p, location: v }))}
              onSubmit={handleUpdateProfile}
            />

            <ProfileQuickActions role={profile.role || 'cliente'} tenantPrefix={tenantPrefix} />
            <ProfileOrders orders={recentOrders} totalCount={stats.totalOrders} tenantPrefix={tenantPrefix} />
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProfileActivity repairs={recentRepairs} tenantPrefix={tenantPrefix} />
          </div>
        </div>
      </div>

      <LogoutDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}
