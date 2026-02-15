'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { ServicesManager } from '@/components/admin/website/ServicesManager'
import { TestimonialsManager } from '@/components/admin/website/TestimonialsManager'
import { MaintenanceModeToggle } from '@/components/admin/website/MaintenanceModeToggle'
import { Settings, Building2, Sparkles, Briefcase, MessageSquare, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function WebsiteAdminPage() {
  return (
    <div className="space-y-6">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px]" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Configuración del Sitio Web</h1>
                  <p className="text-blue-100">Administra el contenido que se muestra en el portal público</p>
                </div>
              </div>
            </div>
            
            <Link href="/inicio" target="_blank">
              <Button 
                variant="secondary" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Eye className="mr-2 h-4 w-4" />
                Vista Previa
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs Premium */}
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-md border">
          <TabsTrigger 
            value="company" 
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger 
            value="hero"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Hero & Stats
          </TabsTrigger>
          <TabsTrigger 
            value="services"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-teal-600 data-[state=active]:text-white transition-all"
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Servicios
          </TabsTrigger>
          <TabsTrigger 
            value="testimonials"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white transition-all"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Testimonios
          </TabsTrigger>
          <TabsTrigger 
            value="maintenance"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-orange-600 data-[state=active]:text-white transition-all"
          >
            <Settings className="mr-2 h-4 w-4" />
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <CompanyInfoForm />
        </TabsContent>

        <TabsContent value="hero" className="space-y-4">
          <HeroEditor />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <ServicesManager />
        </TabsContent>

        <TabsContent value="testimonials" className="space-y-4">
          <TestimonialsManager />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceModeToggle />
        </TabsContent>
      </Tabs>
    </div>
  )
}
