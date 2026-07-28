'use client'

import { Landmark, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BankTransferOption } from '@/types/website-settings'

const MAX_TRANSFER_OPTIONS = 8

function createTransferOption(): BankTransferOption {
  return {
    id: crypto.randomUUID(),
    bankName: '',
    alias: '',
    accountNumber: '',
    accountHolder: '',
  }
}

export function BankTransferOptionsEditor({
  options,
  onChange,
}: {
  options: BankTransferOption[]
  onChange: (options: BankTransferOption[]) => void
}) {
  const updateOption = (
    id: string,
    field: keyof Omit<BankTransferOption, 'id'>,
    value: string
  ) => {
    onChange(options.map((option) => (
      option.id === id ? { ...option, [field]: value } : option
    )))
  }

  const removeOption = (id: string) => {
    onChange(options.filter((option) => option.id !== id))
  }

  const addOption = () => {
    if (options.length >= MAX_TRANSFER_OPTIONS) return
    onChange([...options, createTransferOption()])
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Cuentas bancarias</p>
          <p className="text-[11px] text-muted-foreground">
            El cliente podrá elegir cualquiera de estas opciones.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={options.length >= MAX_TRANSFER_OPTIONS}
          className="h-8 gap-1.5 rounded-md text-xs"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Agregar banco
        </Button>
      </div>

      {options.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
          <Landmark aria-hidden="true" className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold">Todavía no agregaste una cuenta</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Podés informar el pago por las instrucciones o agregar bancos para mostrar sus datos.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, index) => {
            const fieldPrefix = `transfer-option-${option.id}`

            return (
              <fieldset key={option.id} className="rounded-lg border bg-background p-3">
                <legend className="sr-only">Opción bancaria {index + 1}</legend>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Landmark aria-hidden="true" className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold">
                      {option.bankName.trim() || `Banco ${index + 1}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(option.id)}
                    aria-label={`Eliminar opción bancaria ${index + 1}`}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-bank`} className="text-xs">Banco</Label>
                    <Input
                      id={`${fieldPrefix}-bank`}
                      value={option.bankName}
                      onChange={(event) => updateOption(option.id, 'bankName', event.target.value)}
                      placeholder="Ej. Banco Familiar"
                      maxLength={100}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-holder`} className="text-xs">Titular</Label>
                    <Input
                      id={`${fieldPrefix}-holder`}
                      value={option.accountHolder ?? ''}
                      onChange={(event) => updateOption(option.id, 'accountHolder', event.target.value)}
                      placeholder="Nombre del titular"
                      maxLength={100}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-alias`} className="text-xs">Alias</Label>
                    <Input
                      id={`${fieldPrefix}-alias`}
                      value={option.alias ?? ''}
                      onChange={(event) => updateOption(option.id, 'alias', event.target.value)}
                      placeholder="Ej. tienda.familiar"
                      maxLength={100}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${fieldPrefix}-account`} className="text-xs">Cuenta / CBU / CCI</Label>
                    <Input
                      id={`${fieldPrefix}-account`}
                      value={option.accountNumber ?? ''}
                      onChange={(event) => updateOption(option.id, 'accountNumber', event.target.value)}
                      placeholder="Número de cuenta"
                      maxLength={50}
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Completá al menos el alias o el número de cuenta.
                </p>
              </fieldset>
            )
          })}
        </div>
      )}

      {options.length >= MAX_TRANSFER_OPTIONS && (
        <p className="text-[11px] text-muted-foreground">
          Alcanzaste el máximo de {MAX_TRANSFER_OPTIONS} cuentas.
        </p>
      )}
    </div>
  )
}
