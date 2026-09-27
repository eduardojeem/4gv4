import { describe, expect, it } from 'vitest'
import {
  profilePreferencesCacheKey,
  readProfilePreferencesCache,
  writeProfilePreferencesCache,
} from './profile-preferences-cache'

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } satisfies Storage
}

describe('profile preferences cache', () => {
  it('scopes every key to the authenticated user', () => {
    expect(profilePreferencesCacheKey('user-a')).toBe('dashboard-profile-preferences:user-a')
    expect(profilePreferencesCacheKey('user-b')).not.toBe(profilePreferencesCacheKey('user-a'))
  })

  it('never lets one user read another user cache', () => {
    const target = storage()
    writeProfilePreferencesCache('user-a', { notifications: false }, target)
    expect(readProfilePreferencesCache('user-b', target)).toBeNull()
    expect(readProfilePreferencesCache('user-a', target)).toEqual({ notifications: false })
    expect(target.getItem('profile-preferences')).toBeNull()
  })

  it('treats malformed or non-object JSON as a cache miss', () => {
    const target = storage()
    target.setItem(profilePreferencesCacheKey('user-a'), '{bad json')
    expect(readProfilePreferencesCache('user-a', target)).toBeNull()
    target.setItem(profilePreferencesCacheKey('user-a'), '[]')
    expect(readProfilePreferencesCache('user-a', target)).toBeNull()
  })
})
