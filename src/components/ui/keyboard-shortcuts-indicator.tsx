"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence  } from './motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Keyboard, 
  X, 
  Command,
  Plus,
  Search,
  Download,
  Upload,
  RefreshCw,
  HelpCircle,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface KeyboardShortcut {
  keys: string[]
  description: string
  icon?: React.ReactNode
  category?: string
}

interface KeyboardShortcutsIndicatorProps {
  shortcuts?: KeyboardShortcut[]
  className?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

const defaultShortcuts: KeyboardShortcut[] = [
  {
    keys: ['Ctrl', 'N'],
    description: 'Nuevo Cliente',
    icon: <Plus className="h-3 w-3" />,
    category: 'Acciones'
  },
  {
    keys: ['Ctrl', 'K'],
    description: 'Buscar',
    icon: <Search className="h-3 w-3" />,
    category: 'Navegación'
  },
  {
    keys: ['Ctrl', 'E'],
    description: 'Exportar',
    icon: <Download className="h-3 w-3" />,
    category: 'Acciones'
  },
  {
    keys: ['Ctrl', 'I'],
    description: 'Importar',
    icon: <Upload className="h-3 w-3" />,
    category: 'Acciones'
  },
  {
    keys: ['F5'],
    description: 'Actualizar',
    icon: <RefreshCw className="h-3 w-3" />,
    category: 'Navegación'
  },
  {
    keys: ['Shift', '?'],
    description: 'Mostrar Ayuda',
    icon: <HelpCircle className="h-3 w-3" />,
    category: 'Ayuda'
  },
  {
    keys: ['Escape'],
    description: 'Cancelar/Cerrar',
    icon: <ArrowLeft className="h-3 w-3" />,
    category: 'Navegación'
  }
]

const KeyBadge = ({ keyName }: { keyName: string }) => {
  const getKeyIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'ctrl':
      case 'cmd':
        return <Command className="h-2 w-2" />
      default:
        return key
    }
  }

  return (
    <Badge 
      variant="outline" 
      className="px-1.5 py-0.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
    >
      {getKeyIcon(keyName)}
    </Badge>
  )
}

export function KeyboardShortcutsIndicator({
  shortcuts = defaultShortcuts,
  className,
  position = 'bottom-right'
}: KeyboardShortcutsIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  return (
    <>
      {/* Floating button */}
      <motion.div
        className={cn(
          "fixed z-50",
          positionClasses[position],
          className
        )}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200"
          aria-label="Mostrar atajos de teclado"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Shortcuts modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
            >
              <Card className="shadow-2xl border-0">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Keyboard className="h-5 w-5" />
                      Atajos de Teclado
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 max-h-[60vh] overflow-y-auto">
                  {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {categoryShortcuts.map((shortcut, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {shortcut.icon && (
                                <div className="text-gray-500 dark:text-gray-400">
                                  {shortcut.icon}
                                </div>
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {shortcut.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIndex) => (
                                <React.Fragment key={keyIndex}>
                                  <KeyBadge keyName={key} />
                                  {keyIndex < shortcut.keys.length - 1 && (
                                    <span className="text-xs text-gray-400 mx-1">+</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      💡 Presiona <KeyBadge keyName="Shift" /> + <KeyBadge keyName="?" /> en cualquier momento para ver esta ayuda
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}