type Guidance = { hint: string; placeholder: string; categories: string[] }
const entries: Record<string, Guidance> = {
 clothing: { hint: 'Mostrá marcas de indumentaria y accesorios que realmente vendés. Las sugerencias son opcionales.', placeholder: 'Marca de indumentaria o accesorios', categories: ['sports', 'fashion'] },
 electronics: { hint: 'Elegí fabricantes de equipos o accesorios de tu catálogo. Un logo no acredita ser distribuidor autorizado.', placeholder: 'Marca de equipos o accesorios', categories: [] },
 cosmetics: { hint: 'Destacá las marcas de cosméticos y cuidado personal que realmente ofrecés.', placeholder: 'Marca de cosméticos o cuidado personal', categories: [] },
 beauty_services: { hint: 'Opcional: mostrá marcas de productos que usás o vendés, sin presentarlas como certificaciones.', placeholder: 'Marca de productos que usás o vendés', categories: [] },
 barbershop: { hint: 'Opcional: mostrá marcas de cuidado capilar o productos que usás o vendés en el local.', placeholder: 'Marca de cuidado capilar', categories: [] },
 food: { hint: 'Mostrá marcas de alimentos o bebidas que ofrecés. Para elaboración propia podés desactivar esta sección.', placeholder: 'Marca de alimentos o bebidas', categories: [] },
 hardware: { hint: 'Destacá fabricantes de herramientas y materiales presentes en tu oferta.', placeholder: 'Marca de herramientas o materiales', categories: [] },
 general: { hint: 'Priorizá las marcas reales de tu catálogo. Esta sección es opcional y no acredita una relación comercial oficial.', placeholder: 'Nombre de la marca', categories: [] },
}
export function getBrandEditorGuidance(vertical?: string | null): Guidance {
 return entries[vertical ?? 'general'] ?? entries.general
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase()
export function matchesBrandSearch(name: string, query: string): boolean {
 return normalize(name).includes(normalize(query))
}
