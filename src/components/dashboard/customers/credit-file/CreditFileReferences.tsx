import type { CreditFileInput } from '@/lib/credits/credit-file-contract'
import { Button } from '@/components/ui/button'
import { CreditField, CreditSection, selectClass } from './fields'
type References = CreditFileInput['references']
export function CreditFileReferences({ references, onChange }: { references: References; onChange: (value: References) => void }) {
  const update = (index: number, patch: Partial<References[number]>) => onChange(references.map((reference, i) => i === index ? { ...reference, ...patch } : reference))
  return <CreditSection title="Referencias personales">
    <p className="text-sm text-muted-foreground">Una referencia no es un garante.</p>
    <p className="text-sm text-muted-foreground">Verificación manual. El sistema no llama ni envía mensajes a estas personas.</p>
    {references.map((reference, index) => <div key={reference.id ?? index} className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CreditField label={`Nombre de referencia ${index + 1}`} maxLength={200} value={reference.name} onChange={event => update(index, { name: event.target.value })} />
        <CreditField label={`Relación de referencia ${index + 1}`} maxLength={120} value={reference.relationship} onChange={event => update(index, { relationship: event.target.value })} />
        <CreditField label={`Teléfono de referencia ${index + 1}`} type="tel" maxLength={50} value={reference.phone} onChange={event => update(index, { phone: event.target.value })} />
        <label className="grid gap-1.5 text-sm">Verificación de referencia {index + 1}<select className={selectClass} value={reference.verificationStatus} onChange={event => update(index, { verificationStatus: event.target.value as References[number]['verificationStatus'] })}>
          <option value="pending">Pendiente</option><option value="verified">Verificada manualmente</option><option value="unreachable">No localizada</option>
        </select></label>
        <CreditField label={`Comentario de referencia ${index + 1}`} maxLength={1000} value={reference.comment} onChange={event => update(index, { comment: event.target.value })} />
      </div>
      <Button type="button" variant="outline" onClick={() => onChange(references.filter((_, i) => i !== index))}>Quitar referencia {index + 1}</Button>
    </div>)}
    <Button type="button" variant="outline" disabled={references.length >= 5} onClick={() => onChange([...references, { name: '', relationship: '', phone: '', verificationStatus: 'pending', comment: '' }])}>Agregar referencia ({references.length}/5)</Button>
  </CreditSection>
}
