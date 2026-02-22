'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface LogoutDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LogoutDialog({ open, onClose, onConfirm }: LogoutDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <Card className="p-6 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <LogOut className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{'Cerrar sesion?'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tendras que volver a autenticarte para acceder a tu perfil.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button variant="destructive" className="h-10" onClick={onConfirm}>
                  Si, cerrar sesion
                </Button>
                <Button variant="ghost" className="h-10" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
