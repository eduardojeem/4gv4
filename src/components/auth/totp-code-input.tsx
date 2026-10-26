'use client'

import { Input } from '@/components/ui/input'
import { normalizeTotpCode } from '@/lib/auth/mfa'
import { cn } from '@/lib/utils'

type TotpCodeInputProps = {
  id: string
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

/** Campo del código de 6 dígitos. Acepta «123 456» pegado y lo deja en dígitos. */
export function TotpCodeInput({ id, value, onChange, disabled, autoFocus, className }: TotpCodeInputProps) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(event) => onChange(normalizeTotpCode(event.target.value))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={7}
      placeholder="000000"
      disabled={disabled}
      autoFocus={autoFocus}
      className={cn('h-12 text-center font-mono text-xl tracking-[0.5em]', className)}
    />
  )
}
