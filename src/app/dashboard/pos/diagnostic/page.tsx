'use client'

import { ProductsDiagnostic } from '@/components/pos/ProductsDiagnostic'

export default function POSDiagnosticPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Diagnóstico POS</h1>
        <p className="text-gray-600 mt-2">
          Herramienta para diagnosticar y solucionar problemas con productos en el sistema POS
        </p>
      </div>
      
      <ProductsDiagnostic />
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="font-semibold mb-2">Instrucciones</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Ejecute el diagnóstico para verificar el estado actual</li>
          <li>Si hay productos inactivos, use el botón "Activar Todos los Productos"</li>
          <li>Si no hay productos, ejecute las migraciones de la base de datos</li>
          <li>Verifique que esté autenticado correctamente</li>
          <li>Una vez solucionado, regrese al POS principal</li>
        </ol>
      </div>
    </div>
  )
}