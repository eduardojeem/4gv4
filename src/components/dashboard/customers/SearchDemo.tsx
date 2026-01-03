"use client"

/**
 * SearchDemo Component
 * 
 * Componente de demostración que muestra las capacidades
 * de búsqueda inteligente con ejemplos interactivos
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Search, 
  Sparkles, 
  Mail, 
  Phone, 
  Hash, 
  MapPin,
  User,
  Building,
  Zap,
  Target,
  TrendingUp,
  Play,
  RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchExample {
  query: string
  type: 'name' | 'email' | 'phone' | 'code' | 'city' | 'company' | 'fuzzy'
  description: string
  icon: React.ReactNode
  expectedResults: number
  features: string[]
}

interface SearchDemoProps {
  onTryExample: (query: string) => void
  className?: string
}

export function SearchDemo({ onTryExample, className }: SearchDemoProps) {
  const [selectedExample, setSelectedExample] = useState<SearchExample | null>(null)

  const searchExamples: SearchExample[] = [
    {
      query: "juan.perez@email.com",
      type: 'email',
      description: "Búsqueda exacta por email",
      icon: <Mail className="h-4 w-4" />,
      expectedResults: 1,
      features: ["Detección automática de email", "Búsqueda exacta", "Validación de formato"]
    },
    {
      query: "+598 99 123 456",
      type: 'phone',
      description: "Búsqueda por número de teléfono",
      icon: <Phone className="h-4 w-4" />,
      expectedResults: 1,
      features: ["Normalización de formato", "Búsqueda flexible", "Múltiples formatos"]
    },
    {
      query: "CLI-001234",
      type: 'code',
      description: "Búsqueda por código de cliente",
      icon: <Hash className="h-4 w-4" />,
      expectedResults: 1,
      features: ["Detección de patrón", "Búsqueda exacta", "Autocompletado"]
    },
    {
      query: "Juan Pérez",
      type: 'name',
      description: "Búsqueda por nombre completo",
      icon: <User className="h-4 w-4" />,
      expectedResults: 3,
      features: ["Búsqueda fuzzy", "Tolerancia a errores", "Coincidencias parciales"]
    },
    {
      query: "Montevideo",
      type: 'city',
      description: "Búsqueda por ciudad",
      icon: <MapPin className="h-4 w-4" />,
      expectedResults: 15,
      features: ["Filtrado geográfico", "Agrupación por ubicación", "Sugerencias"]
    },
    {
      query: "Tecnología SA",
      type: 'company',
      description: "Búsqueda por empresa",
      icon: <Building className="h-4 w-4" />,
      expectedResults: 5,
      features: ["Búsqueda empresarial", "Clientes corporativos", "Jerarquía"]
    },
    {
      query: "Jua Prez",
      type: 'fuzzy',
      description: "Búsqueda con errores de escritura",
      icon: <Zap className="h-4 w-4" />,
      expectedResults: 2,
      features: ["Corrección automática", "Búsqueda inteligente", "Sugerencias"]
    }
  ]

  const searchFeatures = [
    {
      title: "Detección Automática",
      description: "Reconoce automáticamente emails, teléfonos, códigos y más",
      icon: <Target className="h-5 w-5" />,
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Búsqueda Fuzzy",
      description: "Encuentra resultados incluso con errores de escritura",
      icon: <Zap className="h-5 w-5" />,
      color: "text-green-600 dark:text-green-400"
    },
    {
      title: "Sugerencias Inteligentes",
      description: "Propone búsquedas relacionadas y correcciones",
      icon: <Sparkles className="h-5 w-5" />,
      color: "text-purple-600 dark:text-purple-400"
    },
    {
      title: "Rendimiento Optimizado",
      description: "Búsquedas rápidas con cache inteligente",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-orange-600 dark:text-orange-400"
    }
  ]

  const handleTryExample = (example: SearchExample) => {
    setSelectedExample(example)
    onTryExample(example.query)
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card className="border-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold">Búsqueda Inteligente</span>
              <Badge className="ml-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
                IA Powered
              </Badge>
            </div>
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-300">
            Descubre las capacidades avanzadas de búsqueda con ejemplos interactivos
          </p>
        </CardHeader>
      </Card>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {searchFeatures.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg bg-gray-100 dark:bg-gray-800", feature.color)}>
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Ejemplos Interactivos
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Haz clic en cualquier ejemplo para probarlo
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {searchExamples.map((example, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  onClick={() => handleTryExample(example)}
                  className={cn(
                    "w-full h-auto p-4 flex items-start gap-3 text-left transition-all",
                    selectedExample?.query === example.query && 
                    "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  )}
                >
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {example.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {example.query}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {example.expectedResults} resultado{example.expectedResults !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {example.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {example.features.map((feature, featureIndex) => (
                        <Badge key={featureIndex} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Selected Example Details */}
          <AnimatePresence>
            {selectedExample && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <Separator className="mb-4" />
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      Ejemplo Seleccionado
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedExample(null)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Consulta:</span>
                      <code className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded">
                        {selectedExample.query}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Tipo:</span>
                      <Badge variant="outline">{selectedExample.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Resultados esperados:</span>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {selectedExample.expectedResults}
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}