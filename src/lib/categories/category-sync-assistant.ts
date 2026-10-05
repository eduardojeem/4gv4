import type { GlobalCategory } from './global-catalog'

/**
 * Niveles de confianza para la recomendación.
 * Ninguna sugerencia debe marcarse como «alta» si hay ambigüedad o empate cercano.
 */
export type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'sin coincidencia'

export type UnlinkedCategoryInput = {
  id?: string
  name: string
  count?: number
  organizations?: string[]
  ids?: string[]
  /** Rubro de la empresa del tenant (opcional) */
  vertical?: string | null
  /** Nombre de la categoría padre local en la tienda (opcional) */
  parentName?: string | null
}

export type CandidateSuggestion = {
  targetId: string
  targetName: string
  targetParentName?: string | null
  score: number
  reasons: string[]
}

export type CategoryAnalysisResult = {
  unlinkedName: string
  count: number
  organizations: string[]
  ids: string[]
  vertical: string | null
  bestMatch: CandidateSuggestion | null
  confidence: ConfidenceLevel
  reasons: string[]
  alternatives: CandidateSuggestion[]
}

export type TenantCategoryAnalysisRow = {
  id: string
  name: string
  parentName?: string | null
  organizationName?: string | null
  vertical?: string | null
}

/** Palabras vacías conectivas frecuentes en nombres de categorías comerciales */
const STOP_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a', 'o', 'u', 'por'])

/** Normaliza texto removiendo diacríticos, símbolos y espacios extra */
export function normalizeCategoryText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Lleva a singular palabras comunes en español */
export function singularizeWord(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ces')) return word.slice(0, -3) + 'z'
  // Préstamos y sustantivos terminados en e forman el plural agregando solo s.
  // Evita recortes inválidos como pendrives -> pendriv o muebles -> muebl.
  if (/(?:ves|bles|bres|tres|dres|ches|gues|ques|jes|mes|pes|tes)$/.test(word)) return word.slice(0, -1)
  if (word.endsWith('es') && !word.endsWith('ies')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** Obtiene lista de tokens limpios, singularizados y ordenados */
export function extractSignificantTokens(text: string): string[] {
  const normalized = normalizeCategoryText(text)
  if (!normalized) return []
  const tokens = normalized
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w) && w.length > 0)
    .map(singularizeWord)
  return [...new Set(tokens)].sort()
}

/** Calcula distancia de Levenshtein entre dos cadenas */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const row = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 0; i < a.length; i++) {
    let prev = i + 1
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      const val = Math.min(row[j + 1] + 1, prev + 1, row[j] + cost)
      row[j] = prev
      prev = val
    }
    row[b.length] = prev
  }

  return row[b.length]
}

/**
 * Evalúa similitud tipográfica cuidando que palabras cortas (<= 3 caracteres como TV, PC, RAM)
 * no acepten alteraciones para evitar falsos positivos.
 */
export function evaluateTypographicalMatch(
  source: string,
  target: string,
): { matches: boolean; distance: number; score: number } {
  const s = normalizeCategoryText(source)
  const t = normalizeCategoryText(target)

  if (s === t) return { matches: true, distance: 0, score: 100 }

  const minLen = Math.min(s.length, t.length)
  if (minLen < 4) {
    // Palabras cortas: tolerancia cero a errores tipográficos
    return { matches: false, distance: Math.abs(s.length - t.length), score: 0 }
  }

  const dist = levenshteinDistance(s, t)

  if (dist === 1 && minLen >= 4) {
    return { matches: true, distance: 1, score: 75 }
  }

  if (dist === 2 && minLen >= 7) {
    return { matches: true, distance: 2, score: 65 }
  }

  return { matches: false, distance: dist, score: 0 }
}

/**
 * Puntuación individual entre una categoría no vinculada y una categoría global candidata.
 */
export function scoreCandidate(
  unlinked: UnlinkedCategoryInput,
  category: GlobalCategory,
  parentNameById: Map<string, string>,
): CandidateSuggestion {
  const sourceName = unlinked.name
  const normalizedSource = normalizeCategoryText(sourceName)
  const targetName = category.name
  const normalizedTarget = normalizeCategoryText(targetName)

  let score = 0
  const reasons: string[] = []

  // 1. Coincidencia exacta de nombre
  if (normalizedSource === normalizedTarget) {
    score = Math.max(score, 100)
    reasons.push('Mismo nombre normalizado')
  }

  // 2. Coincidencia con alias
  const aliases = (category.aliases ?? []).map((a) => normalizeCategoryText(a)).filter(Boolean)
  const sourceAliasTokens = extractSignificantTokens(sourceName)
  const matchingAlias = aliases.find((alias) => {
    if (alias === normalizedSource) return true
    // Las siglas cortas requieren coincidencia exacta de token: PC puede estar
    // dentro de "PC y Laptops", pero nunca debe aproximarse a TV o AC.
    return sourceAliasTokens.length === 1
      && sourceAliasTokens[0].length <= 3
      && extractSignificantTokens(alias).includes(sourceAliasTokens[0])
  })
  if (matchingAlias) {
    if (score < 95) {
      score = 95
      reasons.push('Coincide con un alias registrado')
    }
  }

  // 3. Singular vs Plural
  if (score < 90) {
    const sSingular = normalizedSource.split(' ').map(singularizeWord).join(' ')
    const tSingular = normalizedTarget.split(' ').map(singularizeWord).join(' ')
    if (sSingular === tSingular && sSingular.length > 0) {
      score = Math.max(score, 88)
      reasons.push('Coincidencia en singular/plural')
    }
  }

  // 4. Mismos tokens en distinto orden
  const sourceTokens = extractSignificantTokens(sourceName)
  const targetTokens = extractSignificantTokens(targetName)

  if (score < 85 && sourceTokens.length > 1 && targetTokens.length > 1) {
    const sourceJoined = sourceTokens.join(' ')
    const targetJoined = targetTokens.join(' ')
    if (sourceJoined === targetJoined) {
      score = Math.max(score, 85)
      reasons.push('Mismos términos clave en distinto orden')
    }
  }

  // 5. Error tipográfico (Damerau-Levenshtein acotado)
  if (score < 80) {
    const typo = evaluateTypographicalMatch(normalizedSource, normalizedTarget)
    if (typo.matches) {
      score = Math.max(score, typo.score)
      reasons.push(`Posible error tipográfico (${typo.distance} carácter${typo.distance > 1 ? 'es' : ''})`)
    } else {
      // Verificar si algún alias tiene typo match
      for (const alias of aliases) {
        const aliasTypo = evaluateTypographicalMatch(normalizedSource, alias)
        if (aliasTypo.matches) {
          const aliasScore = aliasTypo.score - 3
          if (aliasScore > score) {
            score = aliasScore
            reasons.push(`Variante tipográfica de alias (${aliasTypo.distance} car.)`)
          }
        }
      }
    }
  }

  // 6. Solapamiento parcial de tokens
  if (score < 70 && sourceTokens.length > 0 && targetTokens.length > 0) {
    const commonTokens = sourceTokens.filter((t) => targetTokens.includes(t))
    if (commonTokens.length > 0) {
      const overlapRatio = (2 * commonTokens.length) / (sourceTokens.length + targetTokens.length)
      if (overlapRatio >= 0.5) {
        const overlapScore = Math.round(40 + overlapRatio * 25)
        if (overlapScore > score) {
          score = overlapScore
          reasons.push(`Comparte términos relevantes: "${commonTokens.join(', ')}"`)
        }
      }
    }
  }

  // 7. Modificador de compatibilidad de Rubro / Vertical
  const catVerticals = category.verticals
  const hasVerticalRestriction = Array.isArray(catVerticals) && catVerticals.length > 0
  const tenantVertical = unlinked.vertical?.trim() || null

  if (hasVerticalRestriction && tenantVertical) {
    if (catVerticals.includes(tenantVertical)) {
      score += 10
      reasons.push('Coincide con el rubro de la empresa')
    } else {
      // Conflicto explícito de rubro: penalización severa
      score -= 40
      reasons.push('Conflicto: la categoría pertenece a un rubro diferente')
    }
  }

  // 8. Modificador de categoría superior (Padre)
  const targetParentName = category.parent_id ? parentNameById.get(category.parent_id) ?? null : null
  if (unlinked.parentName && targetParentName) {
    const normTenantParent = normalizeCategoryText(unlinked.parentName)
    const normTargetParent = normalizeCategoryText(targetParentName)
    if (normTenantParent === normTargetParent) {
      score += 20
      reasons.push(`Categoría madre coincidente: "${targetParentName}"`)
    }
  }

  // Normalizar límites de puntaje [0, 100]
  const finalScore = Math.max(0, Math.min(100, score))

  return {
    targetId: category.id,
    targetName: category.name,
    targetParentName,
    score: finalScore,
    reasons,
  }
}

/**
 * Agrupa únicamente categorías con el mismo nombre, rubro y contexto padre.
 * Así un nombre homónimo de dos rubros no hereda el contexto del primer registro.
 */
export function groupUnlinkedCategoriesByContext(
  rows: TenantCategoryAnalysisRow[],
  limit = 120,
): UnlinkedCategoryInput[] {
  const groups = new Map<string, UnlinkedCategoryInput>()

  for (const row of rows) {
    const normalizedName = normalizeCategoryText(row.name)
    const vertical = row.vertical?.trim() || null
    const parentName = row.parentName?.trim() || null
    const key = [normalizedName, vertical ?? '', normalizeCategoryText(parentName)].join('|')
    const current = groups.get(key)

    if (current) {
      current.ids?.push(row.id)
      current.count = (current.count ?? 0) + 1
      if (row.organizationName && !current.organizations?.includes(row.organizationName)) {
        current.organizations?.push(row.organizationName)
      }
      continue
    }

    groups.set(key, {
      name: row.name,
      count: 1,
      organizations: row.organizationName ? [row.organizationName] : [],
      ids: [row.id],
      vertical,
      parentName,
    })
  }

  return [...groups.values()]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

/**
 * Analiza una categoría no vinculada frente al catálogo global completo.
 */
export function analyzeSingleCategory(
  unlinked: UnlinkedCategoryInput,
  catalog: GlobalCategory[],
  parentNameById: Map<string, string>,
): CategoryAnalysisResult {
  const activeCatalog = catalog.filter((c) => c.is_active !== false)

  // Evaluar puntaje para todos los candidatos
  const candidates: CandidateSuggestion[] = []
  for (const cat of activeCatalog) {
    const candidate = scoreCandidate(unlinked, cat, parentNameById)
    if (candidate.score >= 35) {
      candidates.push(candidate)
    }
  }

  // Orden estable: mayor score primero, y en empate orden alfabético por nombre
  candidates.sort((a, b) => b.score - a.score || a.targetName.localeCompare(b.targetName, 'es'))

  const count = unlinked.count ?? (unlinked.ids?.length || 1)
  const organizations = unlinked.organizations ?? []
  const ids = unlinked.ids ?? (unlinked.id ? [unlinked.id] : [])
  const vertical = unlinked.vertical ?? null

  if (candidates.length === 0) {
    return {
      unlinkedName: unlinked.name,
      count,
      organizations,
      ids,
      vertical,
      bestMatch: null,
      confidence: 'sin coincidencia',
      reasons: ['No se encontraron categorías equivalentes ni semejantes en la taxonomía'],
      alternatives: [],
    }
  }

  const best = candidates[0]
  const second = candidates[1] ?? null
  const alternatives = candidates.slice(1, 3)

  let confidence: ConfidenceLevel = 'sin coincidencia'
  const reasons = [...best.reasons]

  // Regla anti-ambigüedad: si el segundo candidato tiene un puntaje muy cercano (< 15 pts),
  // nunca se debe otorgar confianza 'alta'
  const isAmbiguous = second !== null && best.score - second.score < 15

  if (best.score >= 85) {
    if (isAmbiguous) {
      confidence = 'media'
      reasons.push(`Candidato cercano: "${second.targetName}" (${second.score} pts)`)
    } else {
      confidence = 'alta'
    }
  } else if (best.score >= 60) {
    confidence = 'media'
  } else if (best.score >= 35) {
    confidence = 'baja'
  } else {
    confidence = 'sin coincidencia'
  }

  return {
    unlinkedName: unlinked.name,
    count,
    organizations,
    ids,
    vertical,
    bestMatch: confidence === 'sin coincidencia' ? null : best,
    confidence,
    reasons,
    alternatives,
  }
}

/**
 * Analiza un conjunto de categorías no vinculadas y devuelve el reporte estructurado.
 */
export function analyzeUnlinkedBatch(
  unlinkedItems: UnlinkedCategoryInput[],
  catalog: GlobalCategory[],
): CategoryAnalysisResult[] {
  const parentNameById = new Map<string, string>(catalog.map((c) => [c.id, c.name]))

  return unlinkedItems.map((item) => analyzeSingleCategory(item, catalog, parentNameById))
}
