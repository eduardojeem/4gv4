'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ConfigurationGroup as ConfigurationGroupType, ConfigurationSection } from '@/types/settings'
import { ConfigurationSection as ConfigurationSectionComponent } from './configuration-section'
import { cn } from '@/lib/utils'

interface ConfigurationGroupProps {
  group: ConfigurationGroupType
  isExpanded?: boolean
  onToggle?: () => void
  onSettingChange?: (settingId: string, value: any) => void
  searchQuery?: string
  className?: string
}

const iconMap: Record<string, any> = {
  Palette: '🎨',
  Settings: '⚙️',
  Bell: '🔔',
  Package: '📦',
  Shield: '🛡️',
  Database: '💾'
}

export function ConfigurationGroup({
  group,
  isExpanded = false,
  onToggle,
  onSettingChange,
  searchQuery = '',
  className
}: ConfigurationGroupProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  // Filtrar secciones que tienen configuraciones que coinciden con la búsqueda
  const filteredSections = group.sections.filter(section => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    
    // Verificar si el título o descripción de la sección coincide
    if (section.title.toLowerCase().includes(query) || 
        section.description.toLowerCase().includes(query)) {
      return true
    }
    
    // Verificar si alguna configuración en la sección coincide
    return section.settings.some(setting => 
      setting.title.toLowerCase().includes(query) ||
      setting.description.toLowerCase().includes(query) ||
      setting.searchKeywords.some(keyword => keyword.toLowerCase().includes(query))
    )
  })

  if (filteredSections.length === 0 && searchQuery) {
    return null
  }

  const totalSettings = group.sections.reduce((acc, section) => acc + section.settings.length, 0)

  return (
    <Card className={cn('transition-all duration-200', className)}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {iconMap[group.icon] || '⚙️'}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold">
                    {group.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {group.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredSections.length} sección{filteredSections.length !== 1 ? 'es' : ''}
                </Badge>
                {totalSettings > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {totalSettings} configuración{totalSettings !== 1 ? 'es' : ''}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <ConfigurationSectionComponent
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  onSettingChange={onSettingChange}
                  searchQuery={searchQuery}
                />
              ))}
              
              {filteredSections.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No se encontraron configuraciones en este grupo</p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}