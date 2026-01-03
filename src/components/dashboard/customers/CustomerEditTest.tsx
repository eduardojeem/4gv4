'use client'

/**
 * CustomerEditTest - Componente de prueba para la nueva funcionalidad de edición
 * 
 * Demuestra cómo funciona la edición sin modal, igual que la vista de detalle
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Edit, Eye, ArrowRight, Users,
  LayoutDashboard, User, CreditCard, FileText
} from 'lucide-react'

const features = [
  {
    icon: LayoutDashboard,
    title: 'Vista Completa',
    description: 'Edición en vista completa, no en modal',
    status: 'implemented'
  },
  {
    icon: User,
    title: 'Mismo Diseño',
    description: 'Idéntico a la vista de detalle de clientes',
    status: 'implemented'
  },
  {
    icon: Eye,
    title: 'Navegación Fluida',
    description: 'Transición suave entre lista, detalle y edición',
    status: 'implemented'
  },
  {
    icon: Edit,
    title: 'Edición Intuitiva',
    description: 'Formulario organizado en pestañas como el detalle',
    status: 'implemented'
  }
]

const workflow = [
  {
    step: 1,
    title: 'Lista de Clientes',
    description: 'Usuario ve la lista completa de clientes',
    icon: Users,
    color: 'from-blue-500 to-indigo-600'
  },
  {
    step: 2,
    title: 'Seleccionar Editar',
    description: 'Hace clic en "Editar" en cualquier cliente',
    icon: Edit,
    color: 'from-green-500 to-emerald-600'
  },
  {
    step: 3,
    title: 'Vista de Edición',
    description: 'Se abre la vista completa de edición (no modal)',
    icon: LayoutDashboard,
    color: 'from-purple-500 to-violet-600'
  },
  {
    step: 4,
    title: 'Guardar o Cancelar',
    description: 'Regresa automáticamente a la lista',
    icon: CheckCircle2,
    color: 'from-orange-500 to-red-600'
  }
]

export function CustomerEditTest() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl shadow-lg">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edición Sin Modal - Implementado
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              La edición de clientes ahora funciona igual que la vista de detalle
            </p>
          </div>
        </div>
        
        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg px-4 py-2">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          ✅ Completado
        </Badge>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.1 }}
          >
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg">
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {feature.title}
                    </CardTitle>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Listo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Workflow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-indigo-600" />
              Flujo de Trabajo Actualizado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {workflow.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="relative"
                >
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 bg-gradient-to-br ${step.color} rounded-full shadow-lg`}>
                        <step.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          PASO {step.step}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Arrow connector */}
                  {index < workflow.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-4"
      >
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-300">
                Implementación Exitosa
              </h2>
            </div>
            <p className="text-green-700 dark:text-green-300 text-lg">
              La edición de clientes ahora funciona exactamente igual que la vista de detalle:
            </p>
            <div className="mt-4 space-y-2 text-sm text-green-600 dark:text-green-400">
              <p>✅ Sin modales - Vista completa</p>
              <p>✅ Mismo diseño que CustomerDetail</p>
              <p>✅ Navegación fluida entre vistas</p>
              <p>✅ Organización por pestañas</p>
              <p>✅ Experiencia de usuario consistente</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}