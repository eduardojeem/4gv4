'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Download, FileText, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useExportData, ExportFormat } from '@/hooks/use-export-data'
import { Repair } from '@/types/repairs'

interface ExportButtonProps {
    repairs: Repair[]
    disabled?: boolean
}

export function ExportButton({ repairs, disabled = false }: ExportButtonProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
    const [includeMetrics, setIncludeMetrics] = useState(true)
    const { exportRepairs, isExporting } = useExportData()

    const handleExport = async () => {
        await exportRepairs(repairs, {
            format: selectedFormat,
            includeMetrics
        })
        setIsDialogOpen(false)
    }

    const formatOptions = [
        {
            value: 'csv' as ExportFormat,
            label: 'CSV (Excel)',
            description: 'Archivo de valores separados por comas',
            icon: FileSpreadsheet
        },
        {
            value: 'json' as ExportFormat,
            label: 'JSON',
            description: 'Formato de datos estructurados',
            icon: FileJson
        },
        {
            value: 'pdf' as ExportFormat,
            label: 'PDF (Texto)',
            description: 'Documento de texto plano',
            icon: FileText
        }
    ]

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={disabled || repairs.length === 0}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Exportar Datos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => {
                        setSelectedFormat('csv')
                        setIsDialogOpen(true)
                    }}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Exportar como CSV
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={() => {
                        setSelectedFormat('json')
                        setIsDialogOpen(true)
                    }}>
                        <FileJson className="h-4 w-4 mr-2" />
                        Exportar como JSON
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={() => {
                        setSelectedFormat('pdf')
                        setIsDialogOpen(true)
                    }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Exportar como Texto
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                        onClick={() => setIsDialogOpen(true)}
                        className="text-blue-600 dark:text-blue-400"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Opciones avanzadas...
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Exportar Historial de Reparaciones</DialogTitle>
                        <DialogDescription>
                            Configura las opciones de exportación para {repairs.length} reparaciones.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Formato de archivo</Label>
                            <div className="grid gap-3">
                                {formatOptions.map((option) => {
                                    const Icon = option.icon
                                    const selected = selectedFormat === option.value
                                    return (
                                        <div
                                            key={option.value}
                                            className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                                selected
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                                            }`}
                                            onClick={() => setSelectedFormat(option.value)}
                                        >
                                            <div
                                                className={`p-2 rounded mr-3 ${
                                                    selected
                                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">{option.label}</div>
                                                <div className="text-xs text-muted-foreground">{option.description}</div>
                                            </div>
                                            <div
                                                className={`w-4 h-4 rounded-full border ml-3 ${
                                                    selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                                }`}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Opciones adicionales */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Opciones adicionales</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="include-metrics"
                                    checked={includeMetrics}
                                    onCheckedChange={(checked) => setIncludeMetrics(Boolean(checked))}
                                />
                                <Label htmlFor="include-metrics">Incluir métricas de rendimiento</Label>
                            </div>
                        </div>

                        {/* Información del archivo */}
                        <div className="bg-muted/30 p-3 rounded-lg">
                            <div className="text-xs space-y-1">
                                <div>• Total de registros: {repairs.length}</div>
                                <div>• Formato: {formatOptions.find(f => f.value === selectedFormat)?.label}</div>
                                {includeMetrics && <div>• Incluye métricas de rendimiento</div>}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isExporting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Exportando...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
        )
    }
