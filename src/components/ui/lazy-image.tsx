"use client"

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence  } from './motion'
import { User, ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src?: string
  alt: string
  className?: string
  fallback?: React.ReactNode
  placeholder?: React.ReactNode
  onLoad?: () => void
  onError?: () => void
  priority?: boolean
  sizes?: string
  quality?: number
}

export function LazyImage({
  src,
  alt,
  className,
  fallback,
  placeholder,
  onLoad,
  onError,
  priority = false,
  sizes,
  quality = 75
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px' // Start loading 50px before the image comes into view
      }
    )

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [priority])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setIsError(true)
    onError?.()
  }

  const defaultFallback = (
    <div className="flex items-center justify-center w-full h-full bg-gray-100 dark:bg-gray-800 rounded-full">
      <User className="w-1/2 h-1/2 text-gray-400" />
    </div>
  )

  const defaultPlaceholder = (
    <div className="flex items-center justify-center w-full h-full bg-gray-100 dark:bg-gray-800 rounded-full">
      <Loader2 className="w-1/3 h-1/3 text-gray-400 animate-spin" />
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      <AnimatePresence mode="wait">
        {!isInView ? (
          // Not in view - show placeholder
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            {placeholder || defaultPlaceholder}
          </motion.div>
        ) : isError ? (
          // Error state
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            {fallback || defaultFallback}
          </motion.div>
        ) : (
          // Image loading/loaded
          <motion.div
            key="image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative"
          >
            {/* Loading placeholder */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
                <Loader2 className="w-1/3 h-1/3 text-gray-400 animate-spin" />
              </div>
            )}
            
            {/* Actual image */}
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt={alt}
                onLoad={handleLoad}
                onError={handleError}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                loading={priority ? "eager" : "lazy"}
                sizes={sizes}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Avatar component with lazy loading
interface LazyAvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  priority?: boolean
}

export function LazyAvatar({ 
  src, 
  name, 
  size = 'md', 
  className,
  priority = false 
}: LazyAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  }

  const initials = name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const fallback = (
    <div className={cn(
      "flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold",
      sizeClasses[size]
    )}>
      {initials}
    </div>
  )

  return (
    <LazyImage
      src={src}
      alt={`Avatar de ${name}`}
      className={cn("rounded-full", sizeClasses[size], className)}
      fallback={fallback}
      priority={priority}
    />
  )
}