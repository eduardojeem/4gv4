import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRepairHelpProgress, saveRepairHelpProgress } from './repair-help-progress'

describe('repair help progress', () => {
  beforeEach(() => localStorage.clear())

  it('isolates completed tasks by user and guide version', () => {
    saveRepairHelpProgress('user-1', '1.0', { completedTaskIds: ['create-repair'], dismissed: false })

    expect(loadRepairHelpProgress('user-1', '1.0').completedTaskIds).toEqual(['create-repair'])
    expect(loadRepairHelpProgress('user-2', '1.0').completedTaskIds).toEqual([])
    expect(loadRepairHelpProgress('user-1', '2.0').completedTaskIds).toEqual([])
  })

  it('continues with defaults when storage contains invalid data', () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('{broken')
    expect(loadRepairHelpProgress('user-1', '1.0')).toEqual({
      version: '1.0', completedTaskIds: [], dismissed: false,
    })
  })
})
