'use client'

import { useState, useEffect } from 'react'
import { Check, X, RotateCcw, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigurationSetting as ConfigurationSettingType } from '@/types/settings'
import { cn } from '@/lib/utils'

interface ConfigurationSettingProps {
  setting: ConfigurationSettingType
  onChange?: (settingId: string, value: any) => void
  searchQuery?: string
  className?: string
}

export function ConfigurationSetting({
  setting,
  onChange,
  searchQuery = '',
  className
}: ConfigurationSettingProps) {
  const [currentValue, setCurrentValue] = useState(setting.value)
  const [hasChanges, setHasChanges] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setHasChanges(currentValue !== setting.value)
  }, [currentValue, setting.value])

  const validateValue = (value: any): string | null => {
    if (!setting.validation) return null

    const { required, min, max, pattern } = setting.validation

    if (required && (!value || value === '')) {
      return 'Este campo es requerido'
    }

    if (setting.type === 'number') {
      const numValue = Number(value)
      if (min !== undefined && numValue < min) {
        return `El valor mínimo es ${min}`
      }
      if (max !== undefined && numValue > max) {
        return `El valor máximo es ${max}`
      }
    }

    if (setting.type === 'text' && pattern) {
      const regex = new RegExp(pattern)
      if (!regex.test(value)) {
        return 'El formato no es válido'
      }
    }

    return null
  }

  const handleValueChange = (newValue: any) => {
    setCurrentValue(newValue)
    const error = validateValue(newValue)
    setValidationError(error)
    
    if (!error && onChange) {
      onChange(setting.id, newValue)
    }
  }

  const handleReset = () => {
    setCurrentValue(setting.defaultValue)
    setValidationError(null)
    if (onChange) {
      onChange(setting.id, setting.defaultValue)
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  const renderInput = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.id}
              checked={currentValue}
              onCheckedChange={handleValueChange}
            />
            <Label htmlFor={setting.id} className="text-sm font-normal">
              {currentValue ? 'Habilitado' : 'Deshabilitado'}
            </Label>
          </div>
        )

      case 'select':
        return (
          <Select value={currentValue} onValueChange={handleValueChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar opción" />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'textarea':
        return (
          <Textarea
            id={setting.id}
            value={currentValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={`Ingrese ${setting.title.toLowerCase()}`}
            className={cn(validationError && 'border-red-500')}
          />
        )

      case 'number':
        return (
          <Input
            id={setting.id}
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(Number(e.target.value))}
            min={setting.validation?.min}
            max={setting.validation?.max}
            className={cn(validationError && 'border-red-500')}
          />
        )

      case 'color':
        return (
          <div className="flex items-center space-x-2">
            <Input
              id={setting.id}
              type="color"
              value={currentValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-16 h-10 p-1 border rounded"
            />
            <Input
              type="text"
              value={currentValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="#000000"
              className={cn('flex-1', validationError && 'border-red-500')}
            />
          </div>
        )

      default:
        return (
          <Input
            id={setting.id}
            type="text"
            value={currentValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={`Ingrese ${setting.title.toLowerCase()}`}
            className={cn(validationError && 'border-red-500')}
          />
        )
    }
  }

  return (
    <div className={cn('space-y-3 p-4 border rounded-lg bg-gray-50/50 dark:bg-gray-800/50', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <Label htmlFor={setting.id} className="text-sm font-medium">
            {highlightText(setting.title, searchQuery)}
          </Label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {highlightText(setting.description, searchQuery)}
          </p>
          {setting.subcategory && (
            <Badge variant="outline" className="text-xs">
              {setting.subcategory}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 ml-4">
          {hasChanges && (
            <>
              <Badge variant="secondary" className="text-xs">
                Modificado
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-6 w-6 p-0"
                title="Restaurar valor por defecto"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {renderInput()}
        
        {validationError && (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <AlertCircle className="h-3 w-3" />
            <span className="text-xs">{validationError}</span>
          </div>
        )}
        
        {setting.validation?.required && (
          <p className="text-xs text-gray-500">* Campo requerido</p>
        )}
      </div>
    </div>
  )
}