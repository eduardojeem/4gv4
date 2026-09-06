'use client'

import { LockKeyhole, MapPin, Settings2, Store } from 'lucide-react'
import { ChangePasswordDialog } from './change-password-dialog'

export function ProfileSettingsPanel({ hasStore }: { hasStore: boolean }) {
  return (
    <aside aria-labelledby="marketplace-settings-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 id="marketplace-settings-title" className="text-sm font-semibold">Configuración de mi cuenta</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Preferencias personales del Marketplace.</p>
      </div>
      <div className="space-y-4 p-5">
        <a href="#datos-personales" className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span><strong className="block text-sm">Datos y ubicación</strong><span className="text-xs text-muted-foreground">Información usada para contactarte y completar pedidos.</span></span>
        </a>
        <div className="flex items-start gap-3 rounded-lg p-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div><strong className="block text-sm">Seguridad</strong><span className="mb-2 block text-xs text-muted-foreground">Actualizá tu contraseña de acceso.</span><ChangePasswordDialog /></div>
        </div>
        {hasStore && <div className="flex items-start gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><Store className="h-4 w-4 shrink-0" aria-hidden="true" /><p>La configuración de tu negocio se administra desde el panel de la tienda, no desde este perfil personal.</p></div>}
      </div>
    </aside>
  )
}
