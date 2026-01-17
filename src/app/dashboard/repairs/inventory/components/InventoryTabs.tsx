"use client"

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { InventoryTab } from './tabs/InventoryTab'
import { ServicesTab } from './tabs/ServicesTab'
import { MovementsTab } from './tabs/MovementsTab'

export function InventoryTabs() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="overview">Repuestos</TabsTrigger>
        <TabsTrigger value="services">Servicios</TabsTrigger>
        <TabsTrigger value="movements">Movimientos</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <InventoryTab />
      </TabsContent>

      <TabsContent value="services">
        <ServicesTab />
      </TabsContent>

      <TabsContent value="movements">
        <MovementsTab />
      </TabsContent>
    </Tabs>
  )
}
