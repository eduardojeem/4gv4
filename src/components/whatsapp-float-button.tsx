'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { cn } from '@/lib/utils'

interface WhatsAppFloatButtonProps {
  showOnPages?: string[] // Array of paths where to show the button
  hideOnPages?: string[] // Array of paths where to hide the button
}

export function WhatsAppFloatButton({ 
  showOnPages,
  hideOnPages 
}: WhatsAppFloatButtonProps = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const { contactBusiness } = useWhatsApp()

  useEffect(() => {
    // Show button after a delay for better UX
    const timer = setTimeout(() => setIsVisible(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Show tooltip after button appears
    if (isVisible) {
      const tooltipTimer = setTimeout(() => {
        setShowTooltip(true)
        // Hide tooltip after 5 seconds
        setTimeout(() => setShowTooltip(false), 5000)
      }, 2000)
      return () => clearTimeout(tooltipTimer)
    }
  }, [isVisible])

  // Check if button should be shown on current page
  const shouldShow = () => {
    if (typeof window === 'undefined') return false
    const currentPath = window.location.pathname

    if (hideOnPages && hideOnPages.some(path => currentPath.startsWith(path))) {
      return false
    }

    if (showOnPages && !showOnPages.some(path => currentPath.startsWith(path))) {
      return false
    }

    return true
  }

  if (!shouldShow()) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="fixed bottom-6 right-6 z-50 lg:bottom-8 lg:right-8"
        >
          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute bottom-full right-0 mb-4 mr-2"
              >
                <div className="relative">
                  <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-xs">
                    <button
                      onClick={() => setShowTooltip(false)}
                      className="absolute -top-1 -right-1 bg-gray-200 dark:bg-gray-700 rounded-full p-1 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      aria-label="Cerrar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-sm font-medium mb-1">¿Necesitas ayuda?</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Chatea con nosotros por WhatsApp
                    </p>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* WhatsApp Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => contactBusiness()}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all',
              'bg-[#25D366] text-white hover:bg-[#20BA5A]',
              'lg:h-16 lg:w-16',
              'relative overflow-hidden'
            )}
            aria-label="Contactar por WhatsApp"
          >
            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-75" />
            
            {/* Icon */}
            <MessageCircle className="h-7 w-7 lg:h-8 lg:w-8 relative z-10" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
