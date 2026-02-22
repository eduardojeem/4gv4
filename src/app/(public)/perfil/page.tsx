'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { logAndTranslateError } from '@/lib/error-translator'
import { z } from 'zod'

import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileStats } from '@/components/profile/profile-stats'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileQuickActions } from '@/components/profile/profile-quick-actions'
import { ProfileActivity } from '@/components/profile/profile-activity'
import { LogoutDialog } from '@/components/profile/logout-dialog'

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'El telefono debe ser valido').optional().or(z.literal('')),
  avatarUrl: z.string().optional(),
  location: z.string().optional()
})

type ProfileData = z.infer<typeof profileSchema> & { email: string; createdAt?: string; role?: string }

export default function CustomerProfilePage() {
  const { user, loading: loadingAuth } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    name: '', email: '', phone: '', avatarUrl: '', location: '', createdAt: '', role: ''
  })
  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [stats, setStats] = useState({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0 })
  const [recentRepairs, setRecentRepairs] = useState<any[]>([])

  const isDirty = useMemo(() => {
    if (!initialProfile) return false
    return JSON.stringify(profile) !== JSON.stringify(initialProfile)
  }, [profile, initialProfile])

  const loadUserStats = useCallback(async () => {
    if (!user) return
    try {
      const { data: customer } = await supabase
        .from('customers').select('id').eq('profile_id', user.id).maybeSingle()
      if (!customer) {
        setStats({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0 })
        return
      }
      const { data: repairs } = await supabase
        .from('repairs').select('status, final_cost, paid_amount').eq('customer_id', customer.id)
      const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo', 'pausado']
      setStats({
        totalRepairs: repairs?.length || 0,
        activeRepairs: repairs?.filter(r => activeStatuses.includes(r.status)).length || 0,
        completedRepairs: repairs?.filter(r => r.status === 'entregado').length || 0,
      })
      const { data: history } = await supabase
        .from('repairs')
        .select('id, brand, model, status, created_at, final_cost, device')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentRepairs(history || [])
    } catch {
      // Silently handle stats errors
    }
  }, [user, supabase])

  useEffect(() => {
    if (!loadingAuth && !user) { router.push('/login'); return }
    if (user) {
      const data = {
        name: user.profile?.name || '', email: user.email || '', phone: user.profile?.phone || '',
        avatarUrl: user.profile?.avatar_url || '', location: user.profile?.location || '',
        createdAt: user.created_at || '', role: user.role || 'cliente'
      }
      setProfile(data)
      setInitialProfile(data)
      loadUserStats()
    }
  }, [user, loadingAuth, router, loadUserStats])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
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
      await supabase.auth.updateUser({ data: { full_name: profile.name, phone: profile.phone, avatar_url: profile.avatarUrl } })
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: profile.name, phone: profile.phone, avatar_url: profile.avatarUrl, location: profile.location })
        .eq('id', user.id)
      if (profileError) throw profileError
      toast.success('Perfil actualizado correctamente')
      setInitialProfile(profile)
      router.refresh()
    } catch (error) {
      toast.error(logAndTranslateError(error, 'UpdateProfile'))
    } finally { setLoading(false) }
  }

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); toast.success('Sesion cerrada'); router.push('/login') }
    catch { toast.error('Error al cerrar sesion') }
  }

  if (loadingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header section */}
      <ProfileHeader
        name={profile.name}
        email={profile.email}
        role={profile.role || 'cliente'}
        createdAt={profile.createdAt || ''}
        avatarUrl={profile.avatarUrl}
        phone={profile.phone}
        userId={user?.id ?? null}
        onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats row */}
        <div className="mb-8">
          <ProfileStats
            totalRepairs={stats.totalRepairs}
            activeRepairs={stats.activeRepairs}
            completedRepairs={stats.completedRepairs}
          />
        </div>

        {/* Two column layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left column */}
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

            <ProfileQuickActions role={profile.role || 'cliente'} />
          </div>

          {/* Right column - Activity sidebar */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProfileActivity repairs={recentRepairs} />
          </div>
        </div>
      </div>

      {/* Logout dialog */}
      <LogoutDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}
