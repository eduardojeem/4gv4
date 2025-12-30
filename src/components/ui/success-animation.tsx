'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface SuccessAnimationProps {
  isVisible: boolean
  message?: string
  onComplete?: () => void
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  isVisible,
  message = "¡Operación exitosa!",
  onComplete
}) => {
  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onAnimationComplete={() => {
        if (onComplete) {
          setTimeout(onComplete, 1500)
        }
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white rounded-lg shadow-xl p-8 flex flex-col items-center space-y-4 max-w-sm mx-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
          >
            <Check className="w-8 h-8 text-green-600" />
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="text-center"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            ¡Éxito!
          </h3>
          <p className="text-sm text-gray-600">
            {message}
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}