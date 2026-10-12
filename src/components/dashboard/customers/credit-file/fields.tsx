import type { InputHTMLAttributes, ReactNode } from 'react'
export const selectClass = 'min-h-11 w-full rounded-md border bg-background px-3 text-base'
export function CreditField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span><input {...props} className={selectClass} /></label>
}
export function CreditSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5"><h3 className="font-semibold">{title}</h3>{children}</section>
}
