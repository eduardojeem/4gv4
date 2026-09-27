type POSCustomerSummaryProps = {
  name?: string | null
  detail?: string | null
  onChange: () => void
}

export function POSCustomerSummary({ name, detail, onChange }: POSCustomerSummaryProps) {
  return (
    <button type="button" onClick={onChange} className="min-h-11 min-w-11 rounded-lg border px-3 py-2 text-left hover:bg-muted/50">
      <span className="block text-[11px] text-muted-foreground">Cliente</span>
      <span className="block text-[13px] font-semibold">{name || 'Consumidor final'}</span>
      {detail && <span className="block text-[11px] text-muted-foreground">{detail}</span>}
    </button>
  )
}
