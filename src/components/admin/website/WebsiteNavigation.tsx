'use client'

const GROUPS = [
  { title: 'Configuración', items: [['company', 'Empresa y publicación'], ['checkout', 'Pagos y entregas']] },
  { title: 'Diseño de la tienda', items: [['hero', 'Portada'], ['trust_bar', 'Beneficios'], ['carousel', 'Banners promocionales'], ['offers', 'Ofertas']] },
  { title: 'Servicios y atención', items: [['services', 'Catálogo de servicios'], ['process', 'Cómo atendemos']] },
]

export function WebsiteNavigation({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <nav aria-label="Secciones del sitio web" className="min-w-0 rounded-lg border bg-card p-3 lg:sticky lg:top-4">
    <div className="lg:hidden">
      <label htmlFor="website-section" className="mb-2 block text-sm font-medium">Editar sección</label>
      <select id="website-section" value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {GROUPS.map(group => <optgroup key={group.title} label={group.title}>
          {group.items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </optgroup>)}
      </select>
    </div>
    <div className="hidden space-y-5 lg:block">
      {GROUPS.map(group => <div key={group.title}>
        <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground">{group.title}</p>
        <div className="space-y-1">
          {group.items.map(([id, label]) => <button key={id} type="button" aria-current={value === id ? 'page' : undefined} onClick={() => onChange(id)} className={`min-h-11 w-full rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</button>)}
        </div>
      </div>)}
    </div>
  </nav>
}
