'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWhatsApp } from '@/hooks/useWhatsApp'

interface RepairWhatsAppButtonProps {
  repairId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
}

export function RepairWhatsAppButton({ 
  repairId, 
  variant = 'outline',
  size = 'sm' 
}: RepairWhatsAppButtonProps) {
  const { trackRepair } = useWhatsApp()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => trackRepair(repairId)}
      className="gap-2"
    >
      <MessageCircle className="h-4 w-4" />
      Consultar
    </Button>
  )
}
