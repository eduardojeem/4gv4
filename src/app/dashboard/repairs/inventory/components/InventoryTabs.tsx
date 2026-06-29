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
      <TabsList className="bg-background/40 backdrop-blur-md border border-border/50 p-1 mb-6 rounded-full inline-flex mx-auto">
        <TabsTrigger 
          value="overview" 
          className="rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          Repuestos
        </TabsTrigger>
        <TabsTrigger 
          value="services" 
          className="rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          Servicios
        </TabsTrigger>
        <TabsTrigger 
          value="movements" 
          className="rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          Movimientos
        </TabsTrigger>
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
