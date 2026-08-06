'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldCheck, Save, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function WarrantyPolicySettings() {
  const [defaultMonths, setDefaultMonths] = useState<number>(3)
  const [defaultType, setDefaultType] = useState<string>('full')
  const [defaultNotes, setDefaultNotes] = useState<string>('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const storedMonths = localStorage.getItem('repair_default_warranty_months')
      if (storedMonths) setDefaultMonths(parseInt(storedMonths, 10))

      const storedType = localStorage.getItem('repair_default_warranty_type')
      if (storedType) setDefaultType(storedType)

      const storedNotes = localStorage.getItem('repair_default_warranty_notes')
      if (storedNotes) setDefaultNotes(storedNotes)
    } catch {
      // Ignorar errores de SSR
    }
  }, [])

  const handleSave = () => {
    try {
      localStorage.setItem('repair_default_warranty_months', String(defaultMonths))
      localStorage.setItem('repair_default_warranty_type', defaultType)
      localStorage.setItem('repair_default_warranty_notes', defaultNotes)

      setSaved(true)
      toast.success('Política de garantía predeterminada guardada correctamente')
      setTimeout(() => setSaved(false), 2500)
    } catch {
      toast.error('Error al guardar la política de garantía')
    }
  }

  return (
    <Card className="shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Política de Garantías Predeterminada
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Define el tiempo de cobertura y cláusulas que se asignarán automáticamente a cada nueva orden de reparación.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tiempo por defecto */}
          <div className="space-y-2">
            <Label htmlFor="defaultMonths" className="text-sm font-semibold">
              Garantía Predeterminada (Meses)
            </Label>
            <Select
              value={String(defaultMonths)}
              onValueChange={(v) => setDefaultMonths(parseInt(v, 10))}
            >
              <SelectTrigger id="defaultMonths" className="w-full">
                <SelectValue placeholder="Seleccionar duración por defecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin garantía (0 meses)</SelectItem>
                <SelectItem value="1">1 Mes</SelectItem>
                <SelectItem value="2">2 Meses</SelectItem>
                <SelectItem value="3">3 Meses (Recomendado)</SelectItem>
                <SelectItem value="6">6 Meses</SelectItem>
                <SelectItem value="12">12 Meses (1 Año)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esta duración aparecerá preseleccionada en el formulario de Nueva Reparación.
            </p>
          </div>

          {/* Cobertura por defecto */}
          <div className="space-y-2">
            <Label htmlFor="defaultType" className="text-sm font-semibold">
              Tipo de Cobertura Predeterminada
            </Label>
            <Select
              value={defaultType}
              onValueChange={setDefaultType}
            >
              <SelectTrigger id="defaultType" className="w-full">
                <SelectValue placeholder="Seleccionar tipo de cobertura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Garantía Completa (Mano de Obra + Repuestos)</SelectItem>
                <SelectItem value="labor">Solo Mano de Obra</SelectItem>
                <SelectItem value="parts">Solo Repuestos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tipo de garantía sugerido para las órdenes creadas.
            </p>
          </div>
        </div>

        {/* Cláusulas predeterminadas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="defaultNotes" className="text-sm font-semibold">
              Cláusulas y Términos Estándar de la Tienda
            </Label>
            <span className="text-xs text-muted-foreground">Aparecerá pre-cargado en el ticket</span>
          </div>
          <Textarea
            id="defaultNotes"
            rows={4}
            value={defaultNotes}
            onChange={(e) => setDefaultNotes(e.target.value)}
            placeholder="• Aplica únicamente sobre repuestos instalados por nuestro servicio técnico.&#10;• Excluye daños por agua, humedad, caídas o sobretensión.&#10;• Es indispensable presentar este comprobante para hacer efectiva la garantía."
            className="text-sm font-sans"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground font-medium self-center">Añadir texto frecuente:</span>
            {[
              '• No cubre humedad ni contacto con líquidos.',
              '• No cubre caídas ni pantallas rotas posteriores.',
              '• Válido únicamente con comprobante impreso o ticket digital.',
              '• Garantía de batería sujeta a 300 ciclos de carga.'
            ].map((snippet) => (
              <Button
                key={snippet}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[11px] px-2 border-slate-300 dark:border-slate-700"
                onClick={() => {
                  if (defaultNotes.includes(snippet)) return
                  setDefaultNotes(prev => prev ? `${prev}\n${snippet}` : snippet)
                }}
              >
                + {snippet}
              </Button>
            ))}
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="pt-4 flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
          >
            {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Política Guardada' : 'Guardar Política de Garantía'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
