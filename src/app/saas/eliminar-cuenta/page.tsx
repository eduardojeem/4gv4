import type { Metadata } from 'next'
import Link from 'next/link'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { AccountDeletionForm } from '@/components/account/AccountDeletionForm'
import {
  accountSupportEmail,
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_RECORDS_RETENTION_YEARS,
  getAccountDeletionImpact,
} from '@/lib/account/account-deletion'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: `Eliminar tu cuenta | ${branding.platformName}`,
    description: 'Cómo pedir la eliminación de tu cuenta y qué datos se borran o se conservan.',
    alternates: { canonical: '/saas/eliminar-cuenta' },
  }
}

/**
 * Página pública para pedir la eliminación de la cuenta (la URL que pide Google
 * Play). Con sesión iniciada muestra el formulario; sin sesión, cómo pedirla.
 */
export default async function DeleteAccountPage() {
  const [auth, branding] = await Promise.all([resolveRequestAuthUser(), getPlatformBranding()])
  const user = 'reason' in auth ? null : auth.user
  const isSuperAdmin = user?.role === 'super_admin'
  const impact = user && !isSuperAdmin ? await getAccountDeletionImpact(user.id, user.email ?? null) : null
  const supportEmail = accountSupportEmail()

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="border-b pb-6 dark:border-slate-800">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Tu cuenta de {branding.platformName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Eliminar tu cuenta</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Podés pedirlo desde la app de {branding.platformName} (Perfil → Eliminar cuenta) o desde esta página. Si entrás
            con Google, te mandamos un código al correo para confirmar.
          </p>
        </header>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Qué pasa cuando la pedís</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>La cuenta se bloquea en el momento: ya no podés iniciar sesión en la web ni en la app.</li>
            <li>
              A los {ACCOUNT_DELETION_GRACE_DAYS} días se eliminan tus datos personales: nombre, correo, teléfono, foto de
              perfil, preferencias, notificaciones, dispositivos, favoritos y carrito.
            </li>
            <li>
              Si sos el único administrador de un negocio, el negocio se cierra: se cancela la suscripción y la tienda deja
              de estar publicada. Sus productos, clientes y archivos quedan guardados y desactivados; si querés que también
              los borremos, pedilo a soporte.
            </li>
            <li>
              Las ventas, la caja y los comprobantes de los negocios se conservan sin tus datos personales durante{' '}
              {ACCOUNT_RECORDS_RETENTION_YEARS} años, el plazo que fija la ley tributaria.
            </li>
          </ul>
          <p>
            Si te arrepentís, escribinos a{' '}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>{' '}
            antes de que se cumplan los {ACCOUNT_DELETION_GRACE_DAYS} días y cancelamos el pedido: la cuenta y tus negocios
            vuelven a quedar como estaban.
          </p>
        </section>

        <section className="mt-10 rounded-xl border p-5 dark:border-slate-800">
          {isSuperAdmin ? (
            <p className="text-sm">
              Esta es una cuenta de superadmin y no se puede eliminar desde acá. Primero quitale el rol de superadmin desde el
              panel (tiene que quedar otra cuenta con ese rol) y después volvé a esta página.
            </p>
          ) : impact?.pending ? (
            <p className="text-sm">
              Ya pediste eliminar esta cuenta. Tus datos personales se eliminan el{' '}
              {new Date(impact.pending.scheduledFor).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          ) : impact ? (
            <AccountDeletionForm
              email={impact.email}
              closesOrganizations={impact.closesOrganizations.map((org) => org.name)}
              hasPassword={impact.hasPassword}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p>Para pedirlo desde la web, iniciá sesión con la cuenta que querés eliminar.</p>
              <Link
                href="/login?redirect=%2Fsaas%2Feliminar-cuenta"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Iniciar sesión
              </Link>
              <p className="text-slate-500 dark:text-slate-400">
                Si no podés entrar, escribinos a {supportEmail} desde el correo de la cuenta y lo hacemos por vos.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
