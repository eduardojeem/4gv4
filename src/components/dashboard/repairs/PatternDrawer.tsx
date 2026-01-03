'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RotateCcw, Check, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PatternDrawerProps {
  value?: string
  onChange: (pattern: string) => void
  disabled?: boolean
}

interface Point {
  x: number
  y: number
  row: number
  col: number
}

export function PatternDrawer({ value, onChange, disabled }: PatternDrawerProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedPoints, setSelectedPoints] = useState<Point[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Grid configuration
  const GRID_SIZE = 3
  const CANVAS_SIZE = 200
  const DOT_RADIUS = 12
  const DOT_SPACING = CANVAS_SIZE / (GRID_SIZE + 1)

  // Generate grid points
  const points = React.useMemo((): Point[] => {
    const pts: Point[] = []
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        pts.push({
          x: DOT_SPACING * (col + 1),
          y: DOT_SPACING * (row + 1),
          row,
          col
        })
      }
    }
    return pts
  }, [DOT_SPACING, GRID_SIZE])

  // Draw the canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid dots
    points.forEach((point, index) => {
      const isSelected = selectedPoints.some(p => p.row === point.row && p.col === point.col)
      
      ctx.beginPath()
      ctx.arc(point.x, point.y, DOT_RADIUS, 0, 2 * Math.PI)
      
      if (isSelected) {
        ctx.fillStyle = '#3b82f6' // Blue for selected
        ctx.strokeStyle = '#1d4ed8'
        ctx.lineWidth = 3
      } else {
        ctx.fillStyle = '#e5e7eb' // Gray for unselected
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = 2
      }
      
      ctx.fill()
      ctx.stroke()

      // Draw number in selected dots
      if (isSelected) {
        const selectedIndex = selectedPoints.findIndex(p => p.row === point.row && p.col === point.col)
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((selectedIndex + 1).toString(), point.x, point.y)
      }
    })

    // Draw connecting lines
    if (selectedPoints.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      selectedPoints.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      
      ctx.stroke()
    }
  }, [points, selectedPoints, DOT_RADIUS, CANVAS_SIZE])

  // Get point at coordinates
  const getPointAt = useCallback((x: number, y: number): Point | null => {
    return points.find(point => {
      const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2))
      return distance <= DOT_RADIUS + 5 // Add some tolerance
    }) || null
  }, [points, DOT_RADIUS])

  // Get canvas coordinates from mouse/touch event
  const getCanvasCoordinates = useCallback((event: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    let clientX: number, clientY: number

    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    } else if ('clientX' in event) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      return { x: 0, y: 0 }
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }, [CANVAS_SIZE])

  // Handle mouse/touch start
  const handleStart = useCallback((event: MouseEvent | TouchEvent) => {
    if (disabled) return
    
    event.preventDefault()
    const { x, y } = getCanvasCoordinates(event)
    const point = getPointAt(x, y)
    
    if (point) {
      setIsDrawing(true)
      setSelectedPoints([point])
    }
  }, [disabled, getCanvasCoordinates, getPointAt])

  // Handle mouse/touch move
  const handleMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isDrawing || disabled) return
    
    event.preventDefault()
    const { x, y } = getCanvasCoordinates(event)
    const point = getPointAt(x, y)
    
    if (point && !selectedPoints.some(p => p.row === point.row && p.col === point.col)) {
      setSelectedPoints(prev => [...prev, point])
    }
  }, [isDrawing, disabled, getCanvasCoordinates, getPointAt, selectedPoints])

  // Handle mouse/touch end
  const handleEnd = useCallback(() => {
    if (!isDrawing) return
    
    setIsDrawing(false)
    
    // Generate pattern string
    if (selectedPoints.length >= 2) {
      const patternString = selectedPoints
        .map(p => `${p.row + 1}${p.col + 1}`)
        .join('-')
      
      const description = generatePatternDescription(selectedPoints)
      onChange(`${description} (${patternString})`)
    }
  }, [isDrawing, selectedPoints, onChange])

  // Generate human-readable pattern description
  const generatePatternDescription = (points: Point[]): string => {
    if (points.length < 2) return 'Patrón incompleto'
    
    const patterns = [
      { points: [[0,0], [0,1], [0,2]], name: 'Línea horizontal superior' },
      { points: [[1,0], [1,1], [1,2]], name: 'Línea horizontal media' },
      { points: [[2,0], [2,1], [2,2]], name: 'Línea horizontal inferior' },
      { points: [[0,0], [1,0], [2,0]], name: 'Línea vertical izquierda' },
      { points: [[0,1], [1,1], [2,1]], name: 'Línea vertical media' },
      { points: [[0,2], [1,2], [2,2]], name: 'Línea vertical derecha' },
      { points: [[0,0], [1,1], [2,2]], name: 'Diagonal principal' },
      { points: [[0,2], [1,1], [2,0]], name: 'Diagonal inversa' },
      { points: [[0,0], [0,1], [1,1], [1,0]], name: 'Cuadrado superior izquierdo' },
      { points: [[0,1], [0,2], [1,2], [1,1]], name: 'Cuadrado superior derecho' },
      { points: [[1,0], [1,1], [2,1], [2,0]], name: 'Cuadrado inferior izquierdo' },
      { points: [[1,1], [1,2], [2,2], [2,1]], name: 'Cuadrado inferior derecho' },
    ]

    const pointsStr = points.map(p => [p.row, p.col])
    
    // Check for known patterns
    for (const pattern of patterns) {
      if (pattern.points.length === points.length) {
        const matches = pattern.points.every((patternPoint, index) => 
          pointsStr[index] && 
          patternPoint[0] === pointsStr[index][0] && 
          patternPoint[1] === pointsStr[index][1]
        )
        if (matches) return pattern.name
      }
    }

    // Generate generic description
    if (points.length === 2) return 'Línea simple'
    if (points.length === 3) return 'Patrón de 3 puntos'
    if (points.length === 4) return 'Patrón de 4 puntos'
    if (points.length >= 5) return `Patrón complejo (${points.length} puntos)`
    
    return 'Patrón personalizado'
  }

  // Clear pattern
  const clearPattern = useCallback(() => {
    setSelectedPoints([])
    setCurrentPath('')
    onChange('')
  }, [onChange])

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Mouse events
    canvas.addEventListener('mousedown', handleStart)
    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseup', handleEnd)
    canvas.addEventListener('mouseleave', handleEnd)

    // Touch events
    canvas.addEventListener('touchstart', handleStart, { passive: false })
    canvas.addEventListener('touchmove', handleMove, { passive: false })
    canvas.addEventListener('touchend', handleEnd)

    return () => {
      canvas.removeEventListener('mousedown', handleStart)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseup', handleEnd)
      canvas.removeEventListener('mouseleave', handleEnd)
      canvas.removeEventListener('touchstart', handleStart)
      canvas.removeEventListener('touchmove', handleMove)
      canvas.removeEventListener('touchend', handleEnd)
    }
  }, [handleStart, handleMove, handleEnd])

  // Draw canvas when points change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Parse existing value
  useEffect(() => {
    if (!value) return

    const parsedPoints: Point[] = []

    // 1. Try format: "Description (11-12-13)" or "(11-12-13)"
    const parenMatch = value.match(/\(([^)]+)\)/)
    if (parenMatch) {
      const patternString = parenMatch[1]
      const pointCodes = patternString.split(/[-\s,]+/) // split by - or space or comma
      
      pointCodes.forEach(code => {
        if (code.length === 2) {
          // Format RowCol (1-based)
          const row = parseInt(code[0]) - 1
          const col = parseInt(code[1]) - 1
          const point = points.find(p => p.row === row && p.col === col)
          if (point) parsedPoints.push(point)
        }
      })
    } 
    // 2. Try simple numeric sequence format: "1235789" or "1-2-3"
    else {
        // Clean string: remove spaces, dashes, commas
        const cleanVal = value.replace(/[^0-9]/g, '')
        const nums = value.match(/\d+/g)
        
        // Strategy A: If contains numbers > 9, assume RowCol format (e.g. "11 12 13")
        const hasDoubleDigits = nums?.some(n => parseInt(n) > 9)
        
        if (hasDoubleDigits && nums) {
             nums.forEach(n => {
                 const num = parseInt(n)
                 if (num >= 11 && num <= 33) {
                     const s = num.toString()
                     const row = parseInt(s[0]) - 1
                     const col = parseInt(s[1]) - 1
                     const point = points.find(p => p.row === row && p.col === col)
                     if (point) parsedPoints.push(point)
                 }
             })
        }
        // Strategy B: If single digits 1-9 (e.g. "12357" or "1-2-3-5")
        else if (cleanVal.length >= 2) {
             const chars = cleanVal.split('')
             chars.forEach(char => {
                 const num = parseInt(char)
                 if (num >= 1 && num <= 9) {
                     const row = Math.floor((num - 1) / 3)
                     const col = (num - 1) % 3
                     const point = points.find(p => p.row === row && p.col === col)
                     if (point) parsedPoints.push(point)
                 }
             })
        }
    }

    if (parsedPoints.length > 0) {
      setSelectedPoints(parsedPoints)
    }
  }, [value, points])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-purple-600" />
          Dibujar Patrón de Desbloqueo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Dibuja el patrón conectando los puntos en el orden correcto
        </div>
        
        <div 
          ref={containerRef}
          className="flex justify-center"
        >
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={cn(
                "border-2 border-dashed border-purple-200 rounded-lg bg-purple-50/30 cursor-crosshair",
                disabled && "opacity-50 cursor-not-allowed",
                isDrawing && "border-purple-400 bg-purple-50"
              )}
              style={{ 
                width: '200px', 
                height: '200px',
                touchAction: 'none'
              }}
            />
            
            {selectedPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-xs text-muted-foreground text-center">
                  <div className="mb-1">👆</div>
                  <div>Toca y arrastra</div>
                  <div>para dibujar</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedPoints.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-purple-700">
              Patrón dibujado: {selectedPoints.length} punto{selectedPoints.length !== 1 ? 's' : ''}
            </div>
            {value && (
              <div className="text-xs text-muted-foreground bg-purple-50 rounded p-2 border border-purple-200 break-all">
                {value}
              </div>
            )}
          </div>
        ) : (
          value && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-amber-600">
                Formato no visualizable
              </div>
              <div className="text-xs text-muted-foreground bg-amber-50 rounded p-2 border border-amber-200 break-all">
                {value}
              </div>
            </div>
          )
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearPattern}
            disabled={disabled || selectedPoints.length === 0}
            className="flex-1 gap-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar
          </Button>
          
          {selectedPoints.length >= 2 && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={disabled}
              className="flex-1 gap-2 text-xs bg-purple-600 hover:bg-purple-700"
            >
              <Check className="h-3 w-3" />
              Patrón OK
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium">💡 Consejos:</div>
          <ul className="space-y-0.5 ml-3">
            <li>• Conecta al menos 2 puntos</li>
            <li>• Los números muestran el orden</li>
            <li>• Puedes dibujar líneas, formas o patrones complejos</li>
            <li>• El patrón se guarda automáticamente</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}