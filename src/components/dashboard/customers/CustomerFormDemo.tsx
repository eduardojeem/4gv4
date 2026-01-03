'use client'

/**
 * CustomerFormDemo - Componente de demostración del nuevo formulario
 * 
 * Muestra las características y mejoras del CustomerEditFormV2
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, Eye, Save, Zap, Shield, Smartphone,
  CheckCircle2, Star, Palette, Users, Settings
} from 'lucide-react'
import { CustomerEditDialog } from './CustomerEditDialog'
import { Customer } from '@/hooks/use-customer-state'

// Mock customer data for demo
const mockCustomer: Customer = {
  id: 'demo-customer-1',
  customerCode: 'CLI-000001',
  name: 'Juan Pérez García',
  email: 'juan.perez@email.com',
  phone: '+1234567890',
  whatsapp: '+1234567890',
  address: 'Av. Principal 123, Col. Centro',
  city: 'Ciudad de México',
  company: 'Empresa Demo S.A.',
  position: 'Gerente General',
  ruc: 'RFC123456789',
  customer_type: 'premium',
  segment: 'vip',
  status: 'active',
  credit_limit: 50000,
  discount_percentage: 15,
  payment_terms: '30 días',
  preferred_contact: 'email',
  tags: ['VIP', 'Corporativo', 'Frecuente'],
  notes: 'Cliente preferencial con historial excelente',
  birthday: '1985-06-15',
  total_purchases: 25,
  total_repairs: 8,
  registration_date: '2023-01-15T10:00:00Z',
  last_visit: '2024-01-02T14:30:00Z',
  last_activity: '2024-01-02T14:30:00Z',
  credit_score: 9.5,
  satisfaction_score: 9.8,
  lifetime_value: 125000,
  avg_order_value: 5000,
  purchase_frequency: 'high',
  loyalty_points: 2500,
  current_balance: 0,
  pending_amount: 0,
  referral_source: 'Recomendación',
  assigned_salesperson: 'María González',
  last_purchase_amount: 7500,
  total_spent_this_year: 45000,
  avatar: undefined
}

const features = [
  {
    icon: Sparkles,
    title: 'Formulario Multi-Paso',
    description: 'Navegación intuitiva por pasos con progreso visual',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Eye,
    title: 'Vista Previa en Tiempo Real',
    description: 'Visualiza los cambios mientras editas',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Save,
    title: 'Auto-Guardado Inteligente',
    description: 'Guarda automáticamente los cambios cada 3 segundos',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Zap,
    title: 'Validación en Tiempo Real',
    description: 'Validación instantánea con sugerencias útiles',
    color: 'from-yellow-500 to-orange-500'
  },
  {
    icon: Shield,
    title: 'Configuración de Privacidad',
    description: 'Control granular de privacidad y notificaciones',
    color: 'from-red-500 to-pink-500'
  },
  {
    icon: Smartphone,
    title: 'Diseño Responsive',
    description: 'Optimizado para móvil, tablet y desktop',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    icon: Palette,
    title: 'Modo Oscuro Optimizado',
    description: 'Interfaz completamente adaptada al modo oscuro',
    color: 'from-gray-500 to-slate-500'
  },
  {
    icon: Settings,
    title: 'Configuraciones Avanzadas',
    description: 'Gestión de tags, preferencias y configuraciones',
    color: 'from-teal-500 to-blue-500'
  }
]

export function CustomerFormDemo() {
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full border border-blue-200 dark:border-blue-800"
        >
          <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Formulario de Edición Mejorado
          </span>
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold text-gray-900 dark:text-gray-100"
        >
          Nueva Experiencia de Edición
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
        >
          Formulario completamente rediseñado con mejor UX, más funcionalidades y modo oscuro optimizado
        </motion.p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className="h-full border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Demo Button */}
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={() => setShowDemo(true)}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Eye className="h-5 w-5 mr-2" />
            Ver Demostración
          </Button>
        </motion.div>
      </div>

      {/* Improvements List */}
      <Card className="border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            Mejoras Implementadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Experiencia de Usuario</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Navegación por pasos con indicador de progreso
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Vista previa en tiempo real de cambios
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Auto-guardado con indicador visual
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Animaciones fluidas y transiciones suaves
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Funcionalidades</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Gestión avanzada de tags y etiquetas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Configuración de notificaciones y privacidad
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Validación inteligente con sugerencias
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Campos financieros y de segmentación avanzados
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Dialog */}
      <CustomerEditDialog
        customer={mockCustomer}
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        onSuccess={() => {
          setShowDemo(false)
          // En la demo no hacemos nada real
        }}
      />
    </div>
  )
}