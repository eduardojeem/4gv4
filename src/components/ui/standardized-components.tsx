/**
 * Componentes Estandarizados - Sistema de Diseño Consistente
 * 
 * Estos componentes implementan los tokens de diseño estandarizados
 * para garantizar consistencia visual en toda la aplicación.
 */

import * as React from "react"
import { memo } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// ============================================================================
// GRID COMPONENTS
// ============================================================================

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'kpi' | 'dashboard' | 'content' | 'list' | 'compact'
  gap?: 'tight' | 'normal' | 'relaxed' | 'loose'
}

export function StandardGrid({ 
  variant = 'content', 
  gap = 'normal',
  className, 
  children, 
  ...props 
}: GridProps) {
  const gridClasses = {
    kpi: 'grid-kpi',
    dashboard: 'grid-dashboard', 
    content: 'grid-content',
    list: 'grid-list',
    compact: 'grid-compact'
  }

  const gapClasses = {
    tight: 'gap-tight',
    normal: 'gap-normal',
    relaxed: 'gap-relaxed',
    loose: 'gap-loose'
  }

  return (
    <div 
      className={cn(gridClasses[variant], gapClasses[gap], className)}
      {...props}
    >
      {children}
    </div>
  )
}

// ============================================================================
// CARD COMPONENTS
// ============================================================================

interface StandardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'compact' | 'elevated'
  padding?: 'xs' | 'sm' | 'md' | 'lg'
}

export function StandardCard({ 
  variant = 'standard',
  padding,
  className, 
  children, 
  ...props 
}: StandardCardProps) {
  const variantClasses = {
    standard: 'card-standard',
    compact: 'card-compact',
    elevated: 'card-elevated'
  }

  const paddingClasses = padding ? {
    xs: 'card-padding-xs',
    sm: 'card-padding-sm', 
    md: 'card-padding-md',
    lg: 'card-padding-lg'
  }[padding] : ''

  return (
    <div 
      className={cn(
        variantClasses[variant], 
        paddingClasses,
        'transition-standard',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'standard' | 'compact'
  className?: string
}

export const KPICard = memo(function KPICard({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  variant = 'standard',
  className 
}: KPICardProps) {
  const isCompact = variant === 'compact'
  
  return (
    <StandardCard 
      variant={isCompact ? 'compact' : 'standard'}
      className={cn('hover-shadow', className)}
    >
      <div className="flex-normal">
        {icon && (
          <div className={cn(
            'rounded-lg bg-primary/10 text-primary flex items-center justify-center',
            isCompact ? 'p-2' : 'p-3'
          )}>
            <div className={isCompact ? 'icon-sm' : 'icon-md'}>
              {icon}
            </div>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex-controls">
            <div>
              <p className={cn(
                'font-medium text-muted-foreground',
                isCompact ? 'text-xs' : 'text-sm'
              )}>
                {title}
              </p>
              <p className={cn(
                'font-bold text-foreground',
                isCompact ? 'text-xl' : 'text-2xl'
              )}>
                {value}
              </p>
              {description && (
                <p className={cn(
                  'text-muted-foreground',
                  isCompact ? 'text-xs' : 'text-sm'
                )}>
                  {description}
                </p>
              )}
            </div>
            
            {trend && (
              <div className={cn(
                'flex items-center rounded-full px-2 py-1',
                isCompact ? 'text-xs' : 'text-sm',
                trend.isPositive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              )}>
                <span className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </StandardCard>
  )
})

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export const SectionHeader = memo(function SectionHeader({ 
  title, 
  description, 
  actions, 
  className 
}: SectionHeaderProps) {
  return (
    <div className={cn('section-header', className)}>
      <div>
        <h1 className="section-title">{title}</h1>
        {description && (
          <p className="section-description">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex-normal">
          {actions}
        </div>
      )}
    </div>
  )
})

// ============================================================================
// FLEX CONTAINER COMPONENT
// ============================================================================

interface FlexContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'tight' | 'normal' | 'relaxed' | 'controls'
  direction?: 'row' | 'col'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
}

export function FlexContainer({ 
  variant = 'normal',
  direction = 'row',
  align = 'center',
  justify = 'start',
  className, 
  children, 
  ...props 
}: FlexContainerProps) {
  const variantClasses = {
    tight: 'flex-tight',
    normal: 'flex-normal', 
    relaxed: 'flex-relaxed',
    controls: 'flex-controls'
  }

  const directionClass = direction === 'col' ? 'flex-col' : 'flex-row'
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center', 
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  }

  return (
    <div 
      className={cn(
        'flex',
        directionClass,
        alignClasses[align],
        justifyClasses[justify],
        variant !== 'controls' && variantClasses[variant],
        variant === 'controls' && 'flex-controls',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ICON WRAPPER COMPONENT
// ============================================================================

interface IconWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

export function IconWrapper({ 
  size = 'sm',
  variant = 'default',
  className, 
  children, 
  ...props 
}: IconWrapperProps) {
  const sizeClasses = {
    xs: 'icon-xs',
    sm: 'icon-sm',
    md: 'icon-md', 
    lg: 'icon-lg'
  }

  const variantClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  }

  return (
    <div 
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        'flex items-center justify-center shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ============================================================================
// GS ICON - Etiqueta compacta "Gs" para moneda Guaraní
// ============================================================================

export function GSIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm bg-green-600 text-white font-bold',
        'h-4 w-4 text-[10px] leading-none',
        className
      )}
    >
      Gs
    </span>
  )
}

// ============================================================================
// CONTAINER COMPONENT
// ============================================================================

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'section' | 'content'
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

export function Container({ 
  variant = 'content',
  maxWidth = 'full',
  className, 
  children, 
  ...props 
}: ContainerProps) {
  const variantClasses = {
    section: 'container-section',
    content: 'container-content'
  }

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg', 
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full'
  }

  return (
    <div 
      className={cn(
        variantClasses[variant],
        maxWidthClasses[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  type GridProps,
  type StandardCardProps,
  type KPICardProps,
  type SectionHeaderProps,
  type FlexContainerProps,
  type IconWrapperProps,
  type ContainerProps
}
