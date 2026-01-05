'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface BucketStatus {
  name: string
  exists: boolean
  public: boolean
  policies: string[]
  error?: string
}

const REQUIRED_BUCKETS = [
  { name: 'avatars', description: 'Avatares de usuario' },
  { name: 'repair-images', description: 'Imágenes de reparaciones' },
  { name: 'product-images', description: 'Imágenes de productos' }
]

export function StorageDiagnostics() {
  const [buckets, setBuckets] = useState<BucketStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState(false)

  const checkStorageStatus = async () => {
    setLoading(true)
    const supabase = createClient()
    const results: BucketStatus[] = []

    try {
      // Verificar buckets existentes
      const { data: existingBuckets, error } = await supabase.storage.listBuckets()
      
      if (error) {
        toast.error(`Error verificando storage: ${error.message}`)
        return
      }

      for (const requiredBucket of REQUIRED_BUCKETS) {
        const existing = existingBuckets?.find(b => b.name === requiredBucket.name)
        
        results.push({
          name: requiredBucket.name,
          exists: !!existing,
          public: existing?.public ?? false,
          policies: [], // TODO: Verificar políticas RLS
          error: existing ? undefined : 'Bucket no encontrado'
        })
      }

      setBuckets(results)
    } catch (error) {
      console.error('Error checking storage:', error)
      toast.error('Error verificando el estado del storage')
    } finally {
      setLoading(false)
    }
  }

  const fixStorage = async () => {
    setFixing(true)
    try {
      const response = await fetch('/api/admin/setup-storage', {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Storage configurado correctamente')
        await checkStorageStatus()
      } else {
        const error = await response.text()
        toast.error(`Error configurando storage: ${error}`)
      }
    } catch (error) {
      toast.error('Error al configurar storage')
    } finally {
      setFixing(false)
    }
  }

  useEffect(() => {
    checkStorageStatus()
  }, [])

  const allBucketsOk = buckets.every(b => b.exists && b.public)
  const hasIssues = buckets.some(b => !b.exists || !b.public)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {allBucketsOk ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : hasIssues ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Diagnóstico de Storage
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkStorageStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
            {hasIssues && (
              <Button
                size="sm"
                onClick={fixStorage}
                disabled={fixing}
              >
                {fixing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Configurar Storage'
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Verificando storage...</p>
          </div>
        ) : (
          <>
            {allBucketsOk && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ Todos los buckets de storage están configurados correctamente
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {buckets.map((bucket) => (
                <div key={bucket.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bucket.name}</span>
                      {bucket.exists ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Existe
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Faltante
                        </Badge>
                      )}
                      {bucket.exists && (
                        <Badge variant={bucket.public ? "default" : "secondary"}>
                          {bucket.public ? 'Público' : 'Privado'}
                        </Badge>
                      )}
                    </div>
                    {bucket.error && (
                      <p className="text-sm text-red-600 mt-1">{bucket.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hasIssues && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Algunos buckets de storage no están configurados. Esto puede causar errores al subir archivos.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}