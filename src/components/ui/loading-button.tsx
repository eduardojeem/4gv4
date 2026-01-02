'use client'

import React from 'react'
import { motion  } from './motion'
import { Button } from './button'
import { Loader2 } from 'lucide-react'

interface LoadingButtonProps {
  isLoading: boolean
  loadingText?: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText = "Cargando...",
  children,
  onClick,
  disabled,
  variant = "default",
  size = "default",
  className
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      <motion.div
        className="flex items-center space-x-2"
        initial={false}
        animate={{ opacity: 1 }}
      >
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </motion.div>
        )}
        <motion.span
          key={isLoading ? 'loading' : 'normal'}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? loadingText : children}
        </motion.span>
      </motion.div>
    </Button>
  )
}