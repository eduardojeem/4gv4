'use client'

import { UserDiagnostic } from '@/components/auth/UserDiagnostic'

export default function DiagnosticPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Diagnóstico de Usuario</h1>
          <p className="text-muted-foreground">
            Herramienta para diagnosticar y solucionar problemas de permisos
          </p>
        </div>
        <UserDiagnostic />
      </div>
    </div>
  )
}