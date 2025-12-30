"use client"

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CustomerForm, CustomerFormData } from './customer-form'

interface CustomerModalProps {
  onCustomerAdded?: (customer: CustomerFormData) => void
}

export function CustomerModal({ onCustomerAdded }: CustomerModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 dark:from-indigo-500 dark:to-indigo-600 dark:hover:from-indigo-600 dark:hover:to-indigo-700 text-white shadow-lg transition-all duration-300">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
            Registro de Nuevo Cliente
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400 text-base">
            Complete la información del cliente para crear un nuevo registro en el sistema.
          </DialogDescription>
        </DialogHeader>

        <CustomerForm
          onCustomerSaved={(customer) => {
            onCustomerAdded?.(customer as CustomerFormData)
            setOpen(false)
          }}
          submitLabel="Guardar Cliente"
        />
      </DialogContent>
    </Dialog>
  )
}