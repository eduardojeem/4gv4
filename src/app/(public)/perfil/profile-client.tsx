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
import { ProfileOrderHistory } from '@/components/profile/profile-order-history'
import { ProfileAccountSummary } from '@/components/profile/profile-account-summary'
import { ProfileStoreCarts } from '@/components/profile/profile-store-carts'
import { ProfileStores } from '@/components/profile/profile-stores'
import { ProfileFavoritesWidget } from '@/components/profile/profile-favorites-widget'
import { ProfileAccountTypeBanner, type UserOrganizationInfo } from '@/components/profile/profile-account-type-banner'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import type { CustomerAccountSummary } from '@/lib/profile/customer-account-summary'
import type { CustomerStoreSummary } from '@/lib/profile/customer-stores'
import type { StoreCreditByOrganization } from '@/components/profile/profile-account-summary'
import { PublicStoreCredit } from '@/components/public/store-credit/PublicStoreCredit'
import { ProfileSettingsPanel } from '@/components/profile/profile-settings-panel'

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'El telefono debe ser valido').optional().or(z.literal('')),
  avatarUrl: z.string().optional(),
  location: z.string().optional()
})

type ProfileData = z.infer<typeof profileSchema> & {
  email: string
  createdAt?: string
  role?: string
  organization?: UserOrganizationInfo | null
}

interface ProfileClientProps {
  initialData: ProfileData
  userId: string
  /** Tienda de la ruta. Vacio fuera de una: decide el alcance de los datos. */
  tenantPrefix: string
  /**
   * Prefijo de los enlaces. Coincide con `tenantPrefix` dentro de una tienda,
   * pero en el marketplace es `/marketplace`: ahi no hay tenant y sin esto cada
   * enlace salia del marketplace.
   */
  linkPrefix?: string
  /** La cuenta abierta por tienda. Solo aporta con mas de una. */
  stores?: CustomerStoreSummary[]
  stats: { totalRepairs: number; activeRepairs: number; readyRepairs: number; deliveredRepairs: number; totalOrders: number }
  accountSummary: CustomerAccountSummary
  storeCredits?: StoreCreditByOrganization[]
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
    organization?: {
      id: string
      name: string
      slug: string
      logo_url?: string | null
    } | null
  }>
  recentOrders: ProfileOrder[]
  organization?: UserOrganizationInfo | null
}

export function ProfileClient({
  initialData,
  userId,
  tenantPrefix,
  linkPrefix = tenantPrefix,
  stores = [],
  stats,
  accountSummary,
  storeCredits = [],
  recentRepairs,
  recentOrders,
  organization,
}: ProfileClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>(initialData)
  const [initialProfile, setInitialProfile] = useState<ProfileData>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const isMarketplaceProfile = linkPrefix === '/marketplace'

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
    try { await supabase.auth.signOut(); toast.success('Sesion cerrada'); router.push(tenantPrefix ? `${tenantPrefix}/inicio` : linkPrefix || '/login') }
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
        organizationName={profile.organization?.name || organization?.name}
        onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {isMarketplaceProfile ? (
          <>
            {organization && (
              <section aria-labelledby="store-management-title" className="mb-10">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Para tu tienda</p>
                  <h2 id="store-management-title" className="mt-1 text-xl font-bold tracking-tight">Administrar mi negocio</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Accesos de gestión separados de tus compras personales.</p>
                </div>
                <ProfileAccountTypeBanner organization={profile.organization || organization} userRole={profile.role} />
              </section>
            )}

            <section aria-labelledby="marketplace-activity-title" className="mb-10">
              <div className="mb-5 border-b border-border pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Marketplace</p>
                <h2 id="marketplace-activity-title" className="mt-1 text-xl font-bold tracking-tight">Mi actividad</h2>
                <p className="mt-1 text-sm text-muted-foreground">Compras, favoritos, carritos, créditos y reparaciones de todas las tiendas.</p>
              </div>

              <ProfileQuickActions
                role={profile.role || 'cliente'}
                tenantPrefix={linkPrefix}
                variant="marketplace"
                showAuthorizedPersons={false}
              />
              <div className="mt-4"><ProfileStats {...stats} variant="activity" /></div>
              <div className="mt-6">
                <ProfileAccountSummary summary={accountSummary} tenantPrefix={linkPrefix} storeCredits={storeCredits} />
              </div>
              {stores.length > 0 && <div className="mt-6"><ProfileStores stores={stores} /></div>}

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-w-0 flex-col gap-6">
                  <ProfileFavoritesWidget linkPrefix={linkPrefix} />
                  <ProfileStoreCarts />
                  <ProfileOrderHistory initialOrders={recentOrders} totalCount={stats.totalOrders} tenantPrefix={linkPrefix} />
                </div>
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <ProfileActivity repairs={recentRepairs} tenantPrefix={linkPrefix} hideWhenEmpty />
                </div>
              </div>
            </section>

            <section id="datos-personales" aria-labelledby="personal-info-title" className="mb-10 scroll-mt-20 border-t border-border pt-8">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mi cuenta</p>
                <h2 id="personal-info-title" className="mt-1 text-xl font-bold tracking-tight">Datos personales y seguridad</h2>
                <p className="mt-1 text-sm text-muted-foreground">Actualizá tus datos de contacto o cambiá tu contraseña.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                <ProfileSettingsPanel hasStore={Boolean(organization)} />
              </div>
            </section>

            {!organization && (
              <section aria-labelledby="store-information-title" className="border-t border-border pt-8">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Para quienes venden</p>
                  <h2 id="store-information-title" className="mt-1 text-xl font-bold tracking-tight">Información para abrir una tienda</h2>
                </div>
                <ProfileAccountTypeBanner userRole={profile.role} />
              </section>
            )}
          </>
        ) : (
          <>
        <ProfileAccountTypeBanner
          organization={profile.organization || organization}
          userRole={profile.role}
        />

        <div className="mb-8">
          <ProfileStats {...stats} />
        </div>

        <div className="mb-8">
          <ProfileAccountSummary
            summary={accountSummary}
            tenantPrefix={linkPrefix}
            storeCredits={storeCredits}
          />
        </div>

        {stores.length > 1 && (
          <div className="mb-8">
            <ProfileStores stores={stores} />
          </div>
        )}

        {/* Este widget consulta el saldo de UNA organizacion: la de la ruta, y
            si no hay, la de por defecto. Fuera de una tienda eso mostraba el
            saldo de un comercio cualquiera al lado del total real del resumen,
            dos numeros distintos para lo mismo. En el marketplace el desglose
            por tienda vive en el resumen de cuenta. */}
        {tenantPrefix && (
          <div className="mb-8">
            <PublicStoreCredit
              authenticated
              organizationSlug={tenantPrefix.replace(/^\//, '') || null}
            />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <ProfileQuickActions role={profile.role || 'cliente'} tenantPrefix={linkPrefix} />
            <ProfileFavoritesWidget linkPrefix={linkPrefix} />
            <ProfileStoreCarts />
            <ProfileOrders orders={recentOrders} totalCount={stats.totalOrders} tenantPrefix={linkPrefix} />

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
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProfileActivity repairs={recentRepairs} tenantPrefix={linkPrefix} />
          </div>
        </div>
          </>
        )}
      </div>

      <LogoutDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}
