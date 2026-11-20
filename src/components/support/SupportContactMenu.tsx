'use client'

import Link from 'next/link'
import { BookOpen, Clock, LifeBuoy, Mail, MessageCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSupportContact } from '@/hooks/use-support-contact'
import { formatSupportWhatsapp, supportWhatsappLink } from '@/lib/platform/support-contact'
import { cn } from '@/lib/utils'

const WHATSAPP_GREETING = 'Hola, necesito ayuda con mi panel.'

type SupportContactMenuProps = {
  /** Contraído: solo el ícono, como el resto del menú lateral. */
  collapsed?: boolean
  /** La guía vive en /admin: solo se ofrece a quien puede entrar. */
  showGuide?: boolean
  onNavigate?: () => void
  className?: string
}

/** «Ayuda y soporte»: correo, WhatsApp y horario de la plataforma, más la guía. */
export function SupportContactMenu({ collapsed = false, showGuide = false, onNavigate, className }: SupportContactMenuProps) {
  const contact = useSupportContact()
  const whatsappUrl = supportWhatsappLink(contact.whatsapp, WHATSAPP_GREETING)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
            className,
          )}
          aria-label="Ayuda y soporte"
          title={collapsed ? 'Ayuda y soporte' : undefined}
        >
          <LifeBuoy className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span className="truncate">Ayuda y soporte</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Ayuda y soporte</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Escribinos si algo no funciona o tenés una duda.</p>
        </div>
        <ul className="space-y-1 p-2">
          {whatsappUrl && (
            <li>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">WhatsApp</span>
                  <span className="block text-xs text-muted-foreground">{formatSupportWhatsapp(contact.whatsapp)}</span>
                </span>
              </a>
            </li>
          )}
          <li>
            <a href={`mailto:${contact.email}`} className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">Correo</span>
                <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
              </span>
            </a>
          </li>
          {showGuide && (
            <li>
              <Link href="/admin/guia" onClick={onNavigate} className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">Guía del sistema</span>
                  <span className="block text-xs text-muted-foreground">Cómo funciona cada sección del panel</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
        {contact.hours && (
          <p className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.hours}</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
