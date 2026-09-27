"use client"

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useInventory } from '../context/InventoryContext'
import { InventoryTab } from './tabs/InventoryTab'
import { ServicesTab } from './tabs/ServicesTab'
import { MovementsTab } from './tabs/MovementsTab'

export function InventoryTabs() {
  const [activeTab, setActiveTab] = useState("overview")
  const { inventory, services, movements } = useInventory()

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="bg-background/40 backdrop-blur-md border border-border/50 p-1 mb-6 rounded-full inline-flex mx-auto">
        <TabsTrigger 
          value="overview" 
          className="rounded-full px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          <span>Repuestos</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold h-4.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
            {inventory.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger 
          value="services" 
          className="rounded-full px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          <span>Servicios</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold h-4.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
            {services.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger 
          value="movements" 
          className="rounded-full px-5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
        >
          <span>Movimientos</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold h-4.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
            {movements.length}
          </Badge>
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
