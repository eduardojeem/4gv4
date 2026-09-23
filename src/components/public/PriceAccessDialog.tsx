'use client'

/**
 * «¿Por qué no veo el precio?»
 *
 * Un producto publicado sin precio le deja al visitante dos caminos: preguntar
 * por WhatsApp o entrar con su cuenta. Los precios de este catálogo son para
 * clientes mayoristas, y mayorista no es cualquiera que se registre: la tienda
 * habilita el permiso. Decirlo acá evita que alguien cree la cuenta, entre y
 * siga sin ver el precio sin entender por qué.
 *
 * El modal cambia según quién mira: si ya inició sesión, lo que le falta es la
 * habilitación, no registrarse.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Lock, LogIn, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

export interface PriceAccessDialogProps {
  productName: string
  /** Enlace de WhatsApp ya armado, sin el precio adentro. */
  whatsappHref?: string | null
  /** `link` va debajo del precio; `button` es un botón completo. */
  variant?: 'link' | 'button'
  className?: string
  /** Slug de la organización/tienda dueña del producto (vital en marketplace para dirigir al login/registro de esa tienda) */
  organizationSlug?: string
}

export function PriceAccessDialog({
  productName,
  whatsappHref,
  variant = 'link',
  className,
  organizationSlug,
}: PriceAccessDialogProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()

  const tenantSlug = organizationSlug || getTenantSlugFromPathname(pathname ?? '')
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const loginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
  const registerHref = tenantPrefix ? `${tenantPrefix}/cliente/registro` : '/register'

  const conSesion = Boolean(user)

  // Dentro de la vista rápida queda un diálogo anidado: se abre encima de
  // ella, no la reemplaza —cerrar la de abajo desmontaría esta.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            variant === 'link'
              ? 'inline-flex items-center gap-1 text-[11px] font-bold text-primary underline-offset-2 hover:underline'
              : 'flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98]',
            className
          )}
          aria-label={`Ver el precio de ${productName}`}
        >
          <Lock className={variant === 'link' ? 'h-3 w-3' : 'h-4 w-4'} />
          Ver precio
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Los precios son para clientes registrados</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">{productName}</span> se cotiza para
                clientes mayoristas de la tienda.
              </p>
              {conSesion ? (
                <p>
                  Tu cuenta todavía no tiene habilitado el precio mayorista. Escribinos y lo activamos:
                  una vez habilitada, vas a ver los precios en todo el catálogo.
                </p>
              ) : (
                <p>
                  Creá tu cuenta o iniciá sesión. Después pedinos el acceso mayorista y vas a ver los
                  precios en todo el catálogo, sin tener que preguntar producto por producto.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {!conSesion && (
            <>
              <Link
                href={registerHref}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <UserPlus className="h-4 w-4" />
                Crear mi cuenta
              </Link>
              <Link
                href={loginHref}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
              >
                <LogIn className="h-4 w-4" />
                Ya tengo cuenta
              </Link>
            </>
          )}

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]',
                conSesion
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
              )}
            >
              <MessageCircle className="h-4 w-4" />
              Preguntar el precio por WhatsApp
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
