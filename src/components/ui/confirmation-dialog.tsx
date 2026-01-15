'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react'

export interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  requirePassword?: boolean
  requireConfirmText?: string
  onConfirm: (password?: string) => void | Promise<void>
  isLoading?: boolean
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  requirePassword = false,
  requireConfirmText,
  onConfirm,
  isLoading = false
}: ConfirmationDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmTextInput, setConfirmTextInput] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setError('')

    // Validar texto de confirmación si es requerido
    if (requireConfirmText && confirmTextInput !== requireConfirmText) {
      setError(`Debe escribir "${requireConfirmText}" para confirmar`)
      return
    }

    // Validar contraseña si es requerida
    if (requirePassword && !password) {
      setError('Debe ingresar su contraseña')
      return
    }

    try {
      await onConfirm(password)
      onOpenChange(false)
      setPassword('')
      setConfirmTextInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar')
    }
  }

  const handleCancel = () => {
    setPassword('')
    setConfirmTextInput('')
    setError('')
    onOpenChange(false)
  }

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <ShieldAlert className="h-6 w-6 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-orange-600" />
      default:
        return <Lock className="h-6 w-6 text-blue-600" />
    }
  }

  const getButtonVariant = () => {
    switch (variant) {
      case 'destructive':
        return 'destructive'
      case 'warning':
        return 'default'
      default:
        return 'default'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getIcon()}
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {requireConfirmText && (
            <div className="space-y-2">
              <Label htmlFor="confirm-text">
                Escriba <span className="font-mono font-bold">{requireConfirmText}</span> para confirmar
              </Label>
              <Input
                id="confirm-text"
                value={confirmTextInput}
                onChange={(e) => setConfirmTextInput(e.target.value)}
                placeholder={requireConfirmText}
                className={error && confirmTextInput !== requireConfirmText ? 'border-red-500' : ''}
                autoComplete="off"
              />
            </div>
          )}

          {requirePassword && (
            <div className="space-y-2">
              <Label htmlFor="password">
                Ingrese su contraseña para confirmar
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={error && !password ? 'border-red-500' : ''}
                autoComplete="current-password"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={getButtonVariant()}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook para usar el diálogo de confirmación
 */
export function useConfirmationDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    props: Omit<ConfirmationDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>
    resolve?: (confirmed: boolean, password?: string) => void
  }>({
    open: false,
    props: {
      title: '',
      description: ''
    }
  })

  const showConfirmation = (
    props: Omit<ConfirmationDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>
  ): Promise<{ confirmed: boolean; password?: string }> => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        props,
        resolve: (confirmed, password) => {
          resolve({ confirmed, password })
        }
      })
    })
  }

  const handleConfirm = (password?: string) => {
    dialogState.resolve?.(true, password)
    setDialogState(prev => ({ ...prev, open: false }))
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dialogState.resolve?.(false)
    }
    setDialogState(prev => ({ ...prev, open }))
  }

  const DialogComponent = () => (
    <ConfirmationDialog
      {...dialogState.props}
      open={dialogState.open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
    />
  )

  return {
    showConfirmation,
    ConfirmationDialog: DialogComponent
  }
}
