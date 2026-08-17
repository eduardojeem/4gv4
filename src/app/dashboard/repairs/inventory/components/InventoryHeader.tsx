import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, FileDown, HelpCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useInventory } from '../context/InventoryContext'
import { RepairsInventoryGuideDialog } from './RepairsInventoryGuideDialog'

export function InventoryHeader() {
  const router = useRouter()
  const { refresh, exportPDF, loading } = useInventory()
  const [showGuide, setShowGuide] = useState(false)

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Button 
            variant="ghost" 
            className="mb-2 pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Inventario y Servicios
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            Gestiona repuestos, servicios y movimientos de stock del taller.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(true)}
            className="gap-1.5 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-xs"
          >
            <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>¿Cómo funciona?</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={refresh} 
            size="icon"
            disabled={loading}
            title="Actualizar inventario"
            className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-blue-950/20 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportPDF}
            className="text-xs hover:bg-green-50 hover:text-green-600 hover:border-green-300 dark:hover:bg-green-950/20 transition-colors"
          >
            <FileDown className="mr-1.5 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <RepairsInventoryGuideDialog 
        open={showGuide} 
        onOpenChange={setShowGuide} 
      />
    </>
  )
}
