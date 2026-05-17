"use client"

import { useState } from 'react'
import { AlertTriangle, FileSearch, Package, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useStorageCleanup } from '@/hooks/use-storage-cleanup'
import { storageCleanupService } from '@/services/storage-cleanup-service'
import { cn } from '@/lib/utils'

export function StorageCleanupPanel() {
  const {
    orphanedFiles,
    summary,
    scanning,
    deleting,
    selectedPaths,
    scan,
    toggleSelect,
    selectAll,
    deleteSelected,
    deleteAll,
  } = useStorageCleanup()

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)
  const formatBytes = (bytes: number) => storageCleanupService.formatBytes(bytes)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalFiles ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatBytes(summary?.totalSize ?? 0)} en total</p>
          </CardContent>
        </Card>

        <Card className={cn(orphanedFiles.length > 0 && "border-orange-200 bg-orange-50/30")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos huerfanos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", orphanedFiles.length > 0 && "text-orange-600")}>
              {orphanedFiles.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Imagenes sin referencia en productos</p>
          </CardContent>
        </Card>

        <Card className={cn(orphanedFiles.length > 0 && "border-green-200 bg-green-50/30")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Espacio recuperable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", orphanedFiles.length > 0 && "text-green-600")}>
              {formatBytes(summary?.orphanedSize ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Ahorro potencial estimado</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={scan} disabled={scanning}>
            {scanning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Escanear archivos huerfanos
          </Button>

          {orphanedFiles.length > 0 && (
            <>
              <Button variant="outline" onClick={selectAll} disabled={deleting}>
                {selectedPaths.size === orphanedFiles.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>

              <Dialog open={confirmDeleteSelected} onOpenChange={setConfirmDeleteSelected}>
                <DialogTrigger asChild>
                  <Button variant="destructive" disabled={selectedPaths.size === 0 || deleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar seleccionados ({selectedPaths.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar eliminacion</DialogTitle>
                    <DialogDescription>
                      Vas a eliminar {selectedPaths.size} archivos de forma permanente. Esta accion no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setConfirmDeleteSelected(false)}>Cancelar</Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        void deleteSelected()
                        setConfirmDeleteSelected(false)
                      }}
                    >
                      Confirmar eliminacion
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {orphanedFiles.length > 0 && (
          <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
            <DialogTrigger asChild>
              <Button variant="ghost" disabled={deleting} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                Limpieza total
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Limpieza total de storage</DialogTitle>
                <DialogDescription>
                  Se eliminaran {orphanedFiles.length} archivos huerfanos y se liberaran {formatBytes(summary?.orphanedSize ?? 0)}.
                </DialogDescription>
              </DialogHeader>
              <Alert className="mt-2 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Solo se conservaran imagenes referenciadas en la base de datos. Cualquier archivo reservado para uso futuro se perdera.
                </AlertDescription>
              </Alert>
              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    void deleteAll()
                    setConfirmDeleteAll(false)
                  }}
                >
                  Confirmar limpieza total
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-5 w-5 text-primary" />
            Resultados del escaneo
          </CardTitle>
          <CardDescription>
            Archivos en el bucket <code>product-images</code> sin referencias en la tabla de productos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orphanedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <ShieldCheck className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Storage sin residuos detectados</h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  {scanning ? 'Escaneando archivos...' : 'No se encontraron archivos sin uso en este momento.'}
                </p>
              </div>
              {!scanning && <Button variant="outline" size="sm" onClick={scan}>Volver a escanear</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="w-10 pb-3 pl-2">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos los archivos"
                        className="rounded border-gray-300 shadow-sm accent-primary focus:ring-primary"
                        checked={selectedPaths.size === orphanedFiles.length}
                        onChange={selectAll}
                      />
                    </th>
                    <th className="pb-3">Vista previa</th>
                    <th className="pb-3">Ruta del archivo</th>
                    <th className="pb-3 text-right">Tamano</th>
                    <th className="pb-3 pr-2 text-right">Modificado</th>
                  </tr>
                </thead>
                <tbody>
                  {orphanedFiles.map((file) => (
                    <tr key={file.path} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="py-4 pl-2">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${file.name}`}
                          className="rounded border-gray-300 shadow-sm accent-primary focus:ring-primary"
                          checked={selectedPaths.has(file.path)}
                          onChange={() => toggleSelect(file.path)}
                        />
                      </td>
                      <td className="py-4">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.publicUrl}
                            alt={file.name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              const target = event.target as HTMLImageElement
                              target.src = 'https://placehold.co/100x100?text=Err'
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="max-w-[200px] truncate text-sm font-medium">{file.name}</span>
                          <span className="max-w-[320px] truncate text-xs text-muted-foreground">{file.path}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right font-mono text-sm">{formatBytes(file.size)}</td>
                      <td className="py-4 pr-2 text-right text-xs text-muted-foreground">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50">
        <Package className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Este escaneo revisa los campos <code>images[]</code> e <code>image_url</code> de todos los productos.
        </AlertDescription>
      </Alert>
    </div>
  )
}
