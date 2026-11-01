import type { Metadata } from 'next'
import Link from 'next/link'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { AccountDeletionForm } from '@/components/account/AccountDeletionForm'
import { accountSupportEmail, ACCOUNT_DELETION_GRACE_DAYS, getAccountDeletionImpact } from '@/lib/account/account-deletion'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const impact = user ? await getAccountDeletionImpact(user.id, user.email ?? null) : null
  const supportEmail = accountSupportEmail()

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="border-b pb-6 dark:border-slate-800">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Tu cuenta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Eliminar tu cuenta</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Podés pedirlo desde la app (Perfil → Eliminar cuenta) o desde esta página.
          </p>
        </header>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Qué pasa cuando la pedís</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>La cuenta se bloquea en el momento: ya no podés iniciar sesión en la web ni en la app.</li>
            <li>
              A los {ACCOUNT_DELETION_GRACE_DAYS} días se eliminan tus datos personales: nombre, correo, teléfono, foto,
              preferencias, notificaciones, dispositivos y carrito.
            </li>
            <li>
              Si sos el único administrador de un negocio, el negocio se cierra: se cancela la suscripción y la tienda deja
              de estar publicada.
            </li>
            <li>
              Los registros comerciales y fiscales de los negocios (ventas, caja, comprobantes) se conservan el tiempo que
              exige la ley, sin tus datos personales.
            </li>
          </ul>
          <p>
            Si te arrepentís, escribinos a{' '}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>{' '}
            antes de que se cumpla el plazo.
          </p>
        </section>

        <section className="mt-10 rounded-xl border p-5 dark:border-slate-800">
          {impact?.pending ? (
            <p className="text-sm">
              Ya pediste eliminar esta cuenta. Tus datos personales se eliminan el{' '}
              {new Date(impact.pending.scheduledFor).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          ) : impact ? (
            <AccountDeletionForm email={impact.email} closesOrganizations={impact.closesOrganizations.map((org) => org.name)} />
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
