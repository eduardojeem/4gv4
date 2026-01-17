"use client"

import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, FileDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useInventory } from '../context/InventoryContext'

export function InventoryHeader() {
  const router = useRouter()
  const { refresh, exportPDF, loading } = useInventory()

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <Button 
          variant="ghost" 
          className="mb-2 pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Inventario y Servicios
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona repuestos, servicios y movimientos de stock.
        </p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={refresh} 
          size="icon"
          disabled={loading}
          className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-blue-950/20 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button 
          variant="outline" 
          onClick={exportPDF}
          className="hover:bg-green-50 hover:text-green-600 hover:border-green-300 dark:hover:bg-green-950/20 transition-colors"
        >
          <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
      </div>
    </div>
  )
}
