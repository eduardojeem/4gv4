"use client"

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Customer } from '@/hooks/use-customer-state'
import { fieldLabels } from '@/utils/export-utils'
import { X, Download, Search, Table, List, Eye } from 'lucide-react'

interface ExportPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  customers: Customer[]
  selectedFields: string[]
  exportFormat: string
  onConfirmExport: () => void
}

export function ExportPreviewModal({
  isOpen,
  onClose,
  customers,
  selectedFields,
  exportFormat,
  onConfirmExport
}: ExportPreviewModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table')
  
  // Filtrar datos por búsqueda
  const filteredCustomers = customers.filter(customer =>
    selectedFields.some(field => {
      const value = customer[field as keyof Customer]
      return value && String(value).toLowerCase().includes(searchTerm.toLowerCase())
    })
  )

  const previewData = searchTerm ? filteredCustomers.slice(0, 20) : customers.slice(0, 20)

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '-'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5" />
              <span>Vista Previa de Exportación</span>
              <Badge variant="outline" className="ml-2">{exportFormat.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{customers.length} registros total</span>
              <span>•</span>
              <span>{selectedFields.length} campos</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          {/* Controles de Vista */}
          <div className="flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar en los datos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm"
              />
            </div>
            
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table" className="text-xs">
                  <Table className="h-3 w-3 mr-1" />
                  Tabla
                </TabsTrigger>
                <TabsTrigger value="list" className="text-xs">
                  <List className="h-3 w-3 mr-1" />
                  Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Información de Filtros */}
          {searchTerm && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg flex-shrink-0">
              <Search className="h-4 w-4" />
              <span>
                Mostrando {Math.min(20, filteredCustomers.length)} de {filteredCustomers.length} resultados para "{searchTerm}"
              </span>
              {filteredCustomers.length > 20 && (
                <Badge variant="outline" className="text-xs">
                  +{filteredCustomers.length - 20} más
                </Badge>
              )}
            </div>
          )}

          {/* Vista de Datos */}
          <div className="flex-1 min-h-0">
            <Tabs value={viewMode} className="h-full flex flex-col">
              <TabsContent value="table" className="flex-1 mt-0">
                <ScrollArea className="h-full border rounded-lg">
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                        <tr className="border-b bg-gray-50 dark:bg-gray-800">
                          <th className="text-left p-3 font-medium text-xs w-12">#</th>
                          {selectedFields.map((field) => (
                            <th key={field} className="text-left p-3 font-medium text-xs min-w-[120px]">
                              {fieldLabels[field] || field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((customer, index) => (
                          <tr key={customer.id || index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="p-3 text-xs text-gray-500 font-mono">
                              {(searchTerm ? filteredCustomers.indexOf(customer) : index) + 1}
                            </td>
                            {selectedFields.map((field) => (
                              <td key={field} className="p-3 text-xs max-w-[200px]">
                                <div className="truncate" title={formatValue(customer[field as keyof Customer])}>
                                  {formatValue(customer[field as keyof Customer])}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {previewData.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron resultados para "{searchTerm}"</p>
                      </div>
                    )}
                    
                    {!searchTerm && customers.length > 20 && (
                      <div className="text-center py-6 text-gray-500 border-t bg-gray-50/50 dark:bg-gray-900/50">
                        <p className="text-sm">
                          Mostrando los primeros 20 de {customers.length} registros
                        </p>
                        <p className="text-xs mt-1">
                          El archivo completo incluirá todos los registros
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="list" className="flex-1 mt-0">
                <ScrollArea className="h-full border rounded-lg">
                  <div className="p-4 space-y-4">
                    {previewData.map((customer, index) => (
                      <div key={customer.id || index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="text-xs">
                            Registro #{(searchTerm ? filteredCustomers.indexOf(customer) : index) + 1}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {selectedFields.length} campos
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedFields.map((field) => (
                            <div key={field} className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                {fieldLabels[field] || field}
                              </Label>
                              <div className="text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                                {formatValue(customer[field as keyof Customer])}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {previewData.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron resultados para "{searchTerm}"</p>
                      </div>
                    )}
                    
                    {!searchTerm && customers.length > 20 && (
                      <div className="text-center py-6 text-gray-500 border-t bg-gray-50/50 dark:bg-gray-900/50 rounded-lg">
                        <p className="text-sm">
                          Mostrando los primeros 20 de {customers.length} registros
                        </p>
                        <p className="text-xs mt-1">
                          El archivo completo incluirá todos los registros
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={onConfirmExport} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            Confirmar y Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}