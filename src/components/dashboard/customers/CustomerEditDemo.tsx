'use client'

/**
 * CustomerEditDemo - Componente de demostración de las mejoras
 * 
 * Muestra las características del nuevo formulario de edición
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, Eye, Save, Zap, Shield, Smartphone,
  CheckCircle2, Star, Palette, Users, Settings,
  LayoutDashboard, User, CreditCard, FileText,
  ArrowRight, Check
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
  lifetime_value: 125000
}

const features = [
  {
    icon: LayoutDashboard,
    title: 'Diseño Consistente',
    description: 'Misma estructura visual que la vista de detalle',
    color: 'from-blue-500 to-indigo-600'
  },
  {
    icon: User,
    title: 'Organización por Pestañas',
    description: 'Información organizada en secciones lógicas',
    color: 'from-green-500 to-emerald-600'
  },
  {
    icon: Eye,
    title: 'Vista Previa en Tiempo Real',
    description: 'Visualiza los cambios mientras editas',
    color: 'from-purple-500 to-violet-600'
  },
  {
    icon: Save,
    title: 'Validación Inteligente',
    description: 'Validación en tiempo real con mensajes claros',
    color: 'from-orange-500 to-red-600'
  },
  {
    icon: Palette,
    title: 'Modo Oscuro Optimizado',
    description: 'Diseño completamente adaptado al tema oscuro',
    color: 'from-gray-500 to-slate-600'
  },
  {
    icon: Zap,
    title: 'Experiencia Fluida',
    description: 'Animaciones suaves y transiciones elegantes',
    color: 'from-yellow-500 to-amber-600'
  }
]

const tabs = [
  {
    id: 'overview',
    title: 'Información General',
    icon: LayoutDashboard,
    description: 'Datos personales y empresariales'
  },
  {
    id: 'profile',
    title: 'Perfil y Segmentación',
    icon: User,
    description: 'Tipo de cliente y clasificación'
  },
  {
    id: 'financial',
    title: 'Configuración Financiera',
    icon: CreditCard,
    description: 'Límites de crédito y términos'
  },
  {
    id: 'notes',
    title: 'Notas y Etiquetas',
    icon: FileText,
    description: 'Información adicional y tags'
  }
]

export function CustomerEditDemo() {
  const [showDemo, setShowDemo] = useState(false)

  const handleDemoSave = async (data: any) => {
    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Demo data saved:', data)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Formulario de Edición Mejorado
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Misma funcionalidad y diseño que la vista de detalle
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2">
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Implementado
          </Badge>
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <Star className="h-3 w-3 mr-1" />
            Mejorado
          </Badge>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-gradient-to-br ${feature.color} rounded-lg shadow-lg`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </CardTitle>
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

      {/* Tabs Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-indigo-600" />
              Organización por Pestañas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tabs.map((tab, index) => (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <tab.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {tab.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {tab.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Demo Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <Button
          onClick={() => setShowDemo(true)}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Eye className="h-5 w-5 mr-2" />
          Ver Demostración
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </motion.div>

      {/* Demo Modal */}
      <CustomerEditDialog
        customer={mockCustomer}
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        onSuccess={(customer) => {
          console.log('Customer updated:', customer)
          setShowDemo(false)
        }}
      />
    </div>
  )
}