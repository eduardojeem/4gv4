"use client"

/**
 * SearchWithPreviewDemo Component
 * 
 * Demostración de la búsqueda inteligente con vista previa de clientes
 * Muestra las nuevas funcionalidades implementadas
 */

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Sparkles, 
  Eye, 
  MousePointer,
  Zap,
  Target,
  Users,
  ArrowRight
} from "lucide-react"
import { ImprovedSearchBar } from "./ImprovedSearchBar"
import { Customer } from "@/hooks/use-customer-state"

// Mock data para la demostración
const mockCustomers: Customer[] = [
  {
    id: "1",
    customerCode: "CLI-001234",
    name: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "+598 99 123 456",
    address: "Av. 18 de Julio 1234",
    city: "Montevideo",
    customer_type: "premium",
    status: "active",
    total_purchases: 15,
    total_repairs: 3,
    registration_date: "2024-01-15",
    last_visit: "2024-12-20",
    last_activity: "2024-12-25",
    credit_score: 9.2,
    segment: "high_value",
    satisfaction_score: 4.8,
    lifetime_value: 15750,
    avg_order_value: 1050,
    purchase_frequency: "high",
    preferred_contact: "email",
    birthday: "1985-03-15",
    loyalty_points: 2340,
    credit_limit: 5000,
    current_balance: 1200,
    pending_amount: 0,
    notes: "Cliente VIP, excelente historial de pagos",
    tags: ["VIP", "Tecnología"],
    company: "Tecnología SA",
    referral_source: "Recomendación",
    discount_percentage: 10,
    payment_terms: "30 días",
    assigned_salesperson: "María López",
    last_purchase_amount: 2100,
    total_spent_this_year: 8900
  },
  {
    id: "2",
    customerCode: "CLI-005678",
    name: "María González",
    email: "maria.gonzalez@empresa.com",
    phone: "+598 98 765 432",
    address: "Bvar. Artigas 5678",
    city: "Canelones",
    customer_type: "empresa",
    status: "active",
    total_purchases: 8,
    total_repairs: 1,
    registration_date: "2024-03-10",
    last_visit: "2024-12-18",
    last_activity: "2024-12-24",
    credit_score: 8.5,
    segment: "business",
    satisfaction_score: 4.5,
    lifetime_value: 12300,
    avg_order_value: 1537,
    purchase_frequency: "medium",
    preferred_contact: "phone",
    birthday: "1990-07-22",
    loyalty_points: 1850,
    credit_limit: 8000,
    current_balance: 2500,
    pending_amount: 500,
    notes: "Cliente empresarial, compras regulares",
    tags: ["Empresa", "Construcción"],
    company: "Constructora del Sur",
    referral_source: "Web",
    discount_percentage: 5,
    payment_terms: "15 días",
    assigned_salesperson: "Pedro García",
    last_purchase_amount: 3200,
    total_spent_this_year: 6800
  }
]

interface SearchWithPreviewDemoProps {
  className?: string
}

export function SearchWithPreviewDemo({ className }: SearchWithPreviewDemoProps) {
  const [searchValue, setSearchValue] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [demoStep, setDemoStep] = useState(0)

  const demoSteps = [
    {
      title: "Búsqueda Inteligente",
      description: "Escribe para ver sugerencias en tiempo real",
      action: "Prueba escribiendo 'Juan' o 'maria@'",
      icon: <Search className="h-5 w-5" />
    },
    {
      title: "Vista Previa",
      description: "Haz hover sobre una sugerencia para ver detalles",
      action: "Pasa el mouse sobre una sugerencia de cliente",
      icon: <Eye className="h-5 w-5" />
    },
    {
      title: "Selección Directa",
      description: "Haz clic para ver el detalle completo del cliente",
      action: "Clic en una sugerencia para abrir detalles",
      icon: <MousePointer className="h-5 w-5" />
    }
  ]

  const features = [
    {
      title: "Detección Automática",
      description: "Reconoce emails, teléfonos y códigos automáticamente",
      icon: <Target className="h-5 w-5 text-blue-600" />
    },
    {
      title: "Vista Previa Instantánea",
      description: "Muestra información del cliente sin cambiar de página",
      icon: <Zap className="h-5 w-5 text-green-600" />
    },
    {
      title: "Navegación Rápida",
      description: "Acceso directo a detalles del cliente desde búsqueda",
      icon: <Users className="h-5 w-5 text-purple-600" />
    }
  ]

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    console.log("Cliente seleccionado:", customer)
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <Card className="border-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold">Búsqueda con Vista Previa</span>
                <Badge className="ml-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
                  Nueva Funcionalidad
                </Badge>
              </div>
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-300">
              Busca clientes y ve sus detalles instantáneamente sin cambiar de página
            </p>
          </CardHeader>
        </Card>

        {/* Demo Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`h-full transition-all ${demoStep === index ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:shadow-lg'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {step.description}
                      </p>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {step.action}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Interactive Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Demostración Interactiva
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Prueba la búsqueda inteligente con datos de ejemplo
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImprovedSearchBar
              value={searchValue}
              onChange={setSearchValue}
              onSearch={(value) => console.log("Búsqueda:", value)}
              customers={mockCustomers}
              onCustomerSelect={handleCustomerSelect}
              placeholder="Prueba: 'Juan', 'maria@', '+598', 'CLI-001'"
            />

            {/* Selected Customer Display */}
            {selectedCustomer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4"
              >
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 bg-green-500 rounded-full">
                        <ArrowRight className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium text-green-800 dark:text-green-200">
                        Cliente Seleccionado
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {selectedCustomer.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedCustomer.email} • {selectedCustomer.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {selectedCustomer.customer_type}
                        </Badge>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          {selectedCustomer.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
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

        {/* Tips */}
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              💡 Consejos de Uso
            </h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• <strong>Hover:</strong> Pasa el mouse sobre sugerencias para vista previa</li>
              <li>• <strong>Clic:</strong> Haz clic en una sugerencia para ver detalles completos</li>
              <li>• <strong>Teclado:</strong> Usa ↑↓ para navegar y Enter para seleccionar</li>
              <li>• <strong>Patrones:</strong> El sistema detecta automáticamente emails, teléfonos y códigos</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}