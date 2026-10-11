/** Fixed columns and quoted literal patterns: user input never supplies operators. */
export function customerDirectorySearchFilter(value: string): string {
  const term = value.replace(/[,()"\\]/g, '').trim().slice(0, 120)
  if (!term) return ''
  const accents: Record<string, string> = { a: '[aáàäâã]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöôõ]', u: '[uúùüû]', n: '[nñ]' }
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const namePattern = Array.from(term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    .map(character => /\s/.test(character) ? '\\s+' : accents[character] ?? literal(character))
    .join('').replace(/(?:\\s\+)+/g, '\\s+')
  const digits = /^[+\d\s.\-]+$/.test(term) ? term.replace(/\D/g, '') : ''
  const numberPattern = digits ? digits.split('').join('[ .+()-]*') : literal(term)
  const textColumns = ['name', 'first_name', 'last_name', 'company', 'company_name']
  return [
    ...textColumns.map(column => `${column}.imatch.${JSON.stringify(namePattern)}`),
    `email.imatch.${JSON.stringify(literal(term))}`,
    `phone.imatch.${JSON.stringify(numberPattern)}`,
    `customer_code.imatch.${JSON.stringify(literal(term))}`,
    `ruc.imatch.${JSON.stringify(numberPattern)}`,
  ].join(',')
}
