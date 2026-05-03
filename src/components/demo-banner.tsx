'use client'

import { AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isDemoMode } from '@/lib/config'

export function DemoBanner() {
  // Check if we're in demo mode using centralized config
  if (!isDemoMode()) return null

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 py-2">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800 text-sm">
        <strong>Modo Demo:</strong> Esta es una demostración del sistema. 
        Para usar todas las funcionalidades, configura Supabase en el archivo .env.local
      </AlertDescription>
    </Alert>
  )
}