'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Zap, Clock } from 'lucide-react'

interface RepairPerformanceMonitorProps {
  repairCount: number
  filteredCount: number
  isVirtualized?: boolean
}

export function RepairPerformanceMonitor({ 
  repairCount, 
  filteredCount, 
  isVirtualized 
}: RepairPerformanceMonitorProps) {
  const [renderTime, setRenderTime] = useState<number>(0)

  useEffect(() => {
    const start = performance.now()
    
    // Measure render time on next frame
    requestAnimationFrame(() => {
      const end = performance.now()
      setRenderTime(Math.round(end - start))
    })
  }, [repairCount, filteredCount])

  // Only show in development or when performance is concerning
  if (process.env.NODE_ENV === 'production' && renderTime < 100) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{renderTime}ms</span>
      </div>
      
      {isVirtualized && (
        <Badge variant="outline" className="text-xs gap-1">
          <Zap className="h-3 w-3" />
          Virtualizado
        </Badge>
      )}
      
      <span>
        {filteredCount} de {repairCount} reparaciones
      </span>
    </div>
  )
}