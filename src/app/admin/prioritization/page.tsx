'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { PriorityConfig, RepairOrder } from '@/types/repairs'

const initialConfig: PriorityConfig = {
  weights: {
    urgencyWeight: 0.4,
    waitTimeWeight: 0.3,
    historicalValueWeight: 0.2,
    technicalComplexityWeight: 0.1,
  },
  rules: [],
}

const sampleRepair: RepairOrder = {
  id: 'ADM-TEST-001',
  deviceModel: 'iPhone 12',
  issueDescription: 'Pantalla rota',
  createdAt: new Date().toISOString(),
  urgency: 4,
  technicalComplexity: 3,
  stage: 'diagnostico',
  historicalValue: 1000,
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  updatedAt: new Date().toISOString()
}

export default function PriorityAdminPage() {
  const [config, setConfig] = useState<PriorityConfig>(initialConfig)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_PRIORITIZATION_API_KEY

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('priorityConfig') : null
      if (raw) setConfig(JSON.parse(raw))
    } catch {}
  }, [])

  async function testScore() {
    try {
      const res = await fetch('/api/prioritization/score', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ repair: sampleRepair, products: [], config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      setLastScore(Number(data.score))
    } catch (e: unknown) {
      setLastScore(null)
      console.error(e)
    }
  }

  function updateWeight(key: keyof PriorityConfig['weights'], value: string) {
    const num = Number(value)
    setConfig(c => ({ ...c, weights: { ...c.weights, [key]: isNaN(num) ? 0 : num } }))
  }

  async function saveConfig() {
    setIsSaving(true)
    try {
      window.localStorage.setItem('priorityConfig', JSON.stringify(config))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Prioridad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Urgencia</Label>
              <Input type="number" step="0.05" value={config.weights.urgencyWeight}
                onChange={(e)=>updateWeight('urgencyWeight', e.target.value)} />
            </div>
            <div>
              <Label>Tiempo de espera</Label>
              <Input type="number" step="0.05" value={config.weights.waitTimeWeight}
                onChange={(e)=>updateWeight('waitTimeWeight', e.target.value)} />
            </div>
            <div>
              <Label>Valor histórico</Label>
              <Input type="number" step="0.05" value={config.weights.historicalValueWeight}
                onChange={(e)=>updateWeight('historicalValueWeight', e.target.value)} />
            </div>
            <div>
              <Label>Complejidad técnica</Label>
              <Input type="number" step="0.05" value={config.weights.technicalComplexityWeight}
                onChange={(e)=>updateWeight('technicalComplexityWeight', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar'}</Button>
            <Button variant="secondary" onClick={testScore}>Probar score</Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Clave API: {apiKey ? 'configurada' : 'no configurada'}
          </div>

          {lastScore !== null && (
            <div className="text-sm">Resultado de prueba: <strong>{lastScore.toFixed(2)}</strong></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}