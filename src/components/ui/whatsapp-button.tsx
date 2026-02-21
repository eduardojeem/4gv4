'use client'

import { Button } from '@/components/ui/button'
import { MessageCircle } from 'lucide-react'
import { openWhatsApp, type WhatsAppMessageOptions } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface WhatsAppButtonProps {
  phone: string
  message?: string
  variant?: 'default' | 'outline' | 'ghost' | 'floating'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
  showIcon?: boolean
}

export function WhatsAppButton({
  phone,
  message,
  variant = 'default',
  size = 'default',
  className,
  children,
  showIcon = true,
}: WhatsAppButtonProps) {
  const handleClick = () => {
    openWhatsApp({ phone, message })
  }

  // Floating button style
  if (variant === 'floating') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 hover:shadow-xl',
          'bg-[#25D366] text-white',
          'lg:bottom-8 lg:right-8 lg:h-16 lg:w-16',
          className
        )}
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="h-7 w-7 lg:h-8 lg:w-8" />
      </button>
    )
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={cn(
        variant === 'default' && 'bg-[#25D366] hover:bg-[#20BA5A] text-white',
        className
      )}
    >
      {showIcon && <MessageCircle className="mr-2 h-4 w-4" />}
      {children || 'WhatsApp'}
    </Button>
  )
}

interface WhatsAppLinkProps {
  phone: string
  message?: string
  className?: string
  children: React.ReactNode
}

export function WhatsAppLink({
  phone,
  message,
  className,
  children,
}: WhatsAppLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    openWhatsApp({ phone, message })
  }

  return (
    <a
      href="#"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-[#25D366] hover:text-[#20BA5A] transition-colors',
        className
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {children}
    </a>
  )
}
