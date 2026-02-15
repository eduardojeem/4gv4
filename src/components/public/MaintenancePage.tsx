'use client'

import { MaintenanceMode } from '@/types/website-settings'
import { Wrench, Clock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface MaintenancePageProps {
  maintenanceMode: MaintenanceMode
}

export function MaintenancePage({ maintenanceMode }: MaintenancePageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-orange-950 dark:via-red-950 dark:to-pink-950 px-4">
      <div className="mx-auto max-w-2xl text-center">
        {/* Icono animado */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-20" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-2xl">
              <Wrench className="h-12 w-12 text-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl md:text-6xl">
          {maintenanceMode.title}
        </h1>

        {/* Mensaje */}
        <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          {maintenanceMode.message}
        </p>

        {/* Tiempo estimado */}
        {maintenanceMode.estimatedEnd && (
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 px-6 py-3 shadow-lg backdrop-blur-sm">
            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {maintenanceMode.estimatedEnd}
            </span>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-12 rounded-2xl bg-white/60 dark:bg-gray-800/60 p-8 shadow-xl backdrop-blur-sm">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Estamos trabajando para mejorar tu experiencia. Mientras tanto, puedes:
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ir al Login
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
              <a href="mailto:contacto@ejemplo.com">
                Contactar Soporte
              </a>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-500">
          Gracias por tu paciencia. Volveremos pronto.
        </p>
      </div>
    </div>
  )
}
