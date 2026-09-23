'use client'

/**
 * Qué significa cada forma de publicar, a un clic.
 *
 * La explicación vivía abierta debajo del selector: seis viñetas que quien ya
 * las leyó vuelve a saltear en cada producto que carga, empujando el resto del
 * formulario hacia abajo. Acá queda a mano para la primera vez y no estorba
 * a partir de la segunda.
 */

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function VisibilityHelpDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Cómo funciona la visibilidad en tienda"
        >
          <HelpCircle className="h-3 w-3" />
          ¿Cómo funciona?
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cómo funciona esta sección</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2.5 text-left text-xs leading-relaxed text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Público — todos ven el precio:</span>{' '}
                lo ve cualquiera que entre a tu tienda, con el precio a la vista.
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  Público — precio solo para mayoristas:
                </span>{' '}
                el producto se ve igual —foto, descripción y stock— y lo encuentra cualquiera, pero el
                precio queda reservado.
              </p>
              <p className="rounded-lg bg-muted/60 p-2 text-foreground">
                <span className="font-semibold">Lo ve tu cliente mayorista:</span> el que inició sesión
                y tiene habilitado el precio mayorista ve el precio y compra normalmente. Registrarse
                no alcanza: vos habilitás a cada cliente.
              </p>
              <p>
                <span className="font-semibold text-foreground">El visitante común</span>, en cambio, ve{' '}
                <span className="font-semibold text-foreground">Preguntar</span> —abre el WhatsApp de la
                empresa con el producto ya escrito, sin el precio— y{' '}
                <span className="font-semibold text-foreground">Ver precio</span>, que le explica cómo
                obtener una cuenta habilitada.
              </p>
              <p>
                <span className="font-semibold text-foreground">Mayorista:</span> el producto ni
                siquiera aparece para el público general.
              </p>
              <p>
                <span className="font-semibold text-foreground">Oculto:</span> no aparece en la tienda;
                lo seguís usando en el POS.
              </p>
              <p>
                <span className="font-semibold text-foreground">Producto activo:</span> si lo apagás, no
                se vende ni se muestra en ningún lado.
              </p>
              <p>
                Los productos nuevos se cargan con el{' '}
                <span className="font-semibold text-foreground">precio solo para mayoristas</span>.
                Cambiá la opción de arriba para mostrarlo a todos.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
