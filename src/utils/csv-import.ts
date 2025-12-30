export type ParsedCSV = {
  headers: string[]
  rows: string[][]
}

export type UserImport = {
  name: string
  email: string
  role?: string
  status?: string
}

export type ColumnMapping = {
  name?: number
  email?: number
  role?: number
  status?: number
}

// RFC4180-lite CSV parser with quoted fields and escaped quotes
export function parseCSV(text: string): ParsedCSV {
  const rows: string[][] = []
  let i = 0
  const len = text.length
  const current: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }
  const pushRow = () => {
    // avoid pushing empty trailing row
    if (!(current.length === 1 && current[0] === '')) {
      rows.push([...current])
    }
    current.length = 0
  }

  while (i < len) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        field += ch
        i++
        continue
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
        continue
      }
      if (ch === ',') {
        pushField()
        i++
        continue
      }
      if (ch === '\n') {
        pushField()
        pushRow()
        i++
        continue
      }
      if (ch === '\r') {
        // handle CRLF
        if (text[i + 1] === '\n') {
          pushField()
          pushRow()
          i += 2
          continue
        }
        i++
        continue
      }
      field += ch
      i++
    }
  }
  // flush last field/row
  pushField()
  pushRow()

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1)
  return { headers, rows: dataRows }
}

export function detectUserColumnMapping(headers: string[]): ColumnMapping {
  const indexOf = (pred: (h: string) => boolean) => {
    const idx = headers.findIndex(h => pred(h.toLowerCase()))
    return idx >= 0 ? idx : undefined
  }
  return {
    name: indexOf(h => /name|nombre|full.?name/.test(h)),
    email: indexOf(h => /email|correo|mail/.test(h)),
    role: indexOf(h => /role|rol|perfil/.test(h)),
    status: indexOf(h => /status|estado/.test(h)),
  }
}

export function mapUserRows(rows: string[][], mapping: ColumnMapping): UserImport[] {
  return rows.map(r => ({
    name: mapping.name !== undefined ? (r[mapping.name!] || '').trim() : '',
    email: mapping.email !== undefined ? (r[mapping.email!] || '').trim() : '',
    role: mapping.role !== undefined ? (r[mapping.role!] || '').trim() : undefined,
    status: mapping.status !== undefined ? (r[mapping.status!] || '').trim() : undefined,
  }))
}

export function validateUserRow(u: UserImport) {
  const issues: string[] = []
  if (!u.name) issues.push('Falta nombre')
  if (!u.email) issues.push('Falta email')
  else if (!/^\S+@\S+\.\S+$/.test(u.email)) issues.push('Email inválido')
  if (u.role && !/^admin|vendedor|tecnico|cliente$/.test(u.role)) issues.push('Rol desconocido')
  if (u.status && !/^active|inactive|pending$/.test(u.status)) issues.push('Estado desconocido')
  return issues
}