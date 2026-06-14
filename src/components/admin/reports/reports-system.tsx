"use client"

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, BarChart3, Package } from 'lucide-react'
import AnalyticsDashboard from './analytics-dashboard'
import InventoryReports from './inventory-reports'
import { PlanGate } from '@/components/admin/PlanGate'

export default function ReportsSystem() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <FileText className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Sistema de Reportes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Centro de inteligencia de negocios y análisis</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger
            value="dashboard"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 shadow-sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Ventas y Analytics
          </TabsTrigger>
          <TabsTrigger
            value="inventory"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 shadow-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Inventario
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dashboard (Analytics) — requiere plan con módulo 'analytics' (Pro+) */}
        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          {activeTab === 'dashboard' && (
            <PlanGate
              module="analytics"
              requiredPlan="Pro"
              title="Analytics avanzado"
              description="El dashboard de ventas y analítica está disponible desde el plan Pro. Subí tu plan para desbloquear métricas, tendencias y rankings."
            >
              <AnalyticsDashboard />
            </PlanGate>
          )}
        </TabsContent>

        {/* Tab: Inventario */}
        <TabsContent value="inventory" className="space-y-6 focus-visible:outline-none">
          {activeTab === 'inventory' && <InventoryReports />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
