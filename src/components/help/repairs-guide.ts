import guideContent from './repairs-guide-content.json'

export type RepairGuideAudience = 'operator' | 'technician' | 'admin'

export type RepairGuideStep = {
  title: string
  body: string
  action: string
  anchorId: string
  fallback: string
  route?: string
}

export type RepairGuideTask = {
  id: string
  title: string
  summary: string
  keywords: string[]
  audiences: RepairGuideAudience[]
  icon: string
  steps: RepairGuideStep[]
}

export type RepairGuideTrack = {
  id: string
  title: string
  description: string
  audiences: RepairGuideAudience[]
  tasks: RepairGuideTask[]
}

export type RepairGuide = {
  version: string
  title: string
  subtitle: string
  tracks: RepairGuideTrack[]
}

function assertGuide(value: unknown): asserts value is RepairGuide {
  const guide = value as Partial<RepairGuide>
  if (!guide.version || !guide.title || !Array.isArray(guide.tracks)) {
    throw new Error('INVALID_REPAIRS_GUIDE')
  }
  for (const track of guide.tracks) {
    if (!track.id || !Array.isArray(track.tasks)) throw new Error('INVALID_REPAIRS_GUIDE_TRACK')
    for (const task of track.tasks) {
      if (!task.id || !task.title || !Array.isArray(task.steps)) throw new Error('INVALID_REPAIRS_GUIDE_TASK')
      if (task.steps.some(step => !step.anchorId || !step.fallback)) throw new Error('INVALID_REPAIRS_GUIDE_STEP')
    }
  }
}

assertGuide(guideContent)

export const repairsGuide = guideContent
export const REPAIRS_GUIDE_VERSION = repairsGuide.version
export const REPAIRS_GUIDE_PDF_PATH = '/guides/guia-reparaciones-v1.pdf'

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}

function isVisibleTo(audiences: RepairGuideAudience[], audience: RepairGuideAudience) {
  return audiences.includes(audience)
}

export function getRepairGuideTracks(audience: RepairGuideAudience): RepairGuideTrack[] {
  return repairsGuide.tracks
    .filter(track => isVisibleTo(track.audiences, audience))
    .map(track => ({
      ...track,
      tasks: track.tasks.filter(task => isVisibleTo(task.audiences, audience)),
    }))
    .filter(track => track.tasks.length > 0)
}

export function searchRepairGuide(query: string, audience: RepairGuideAudience): RepairGuideTask[] {
  const normalizedQuery = normalize(query)
  const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 1 && term !== 'y')
  const tasks = getRepairGuideTracks(audience).flatMap(track => track.tasks)
  if (!normalizedQuery) return tasks

  return tasks
    .map(task => {
      const title = normalize(task.title)
      const searchable = normalize([task.title, task.summary, ...task.keywords].join(' '))
      const matchesAllTerms = queryTerms.every(term => searchable.includes(term))
      const score = title.includes(normalizedQuery) ? 3 : matchesAllTerms ? 2 : 0
      return { task, score }
    })
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(result => result.task)
}
