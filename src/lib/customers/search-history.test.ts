// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { searchHistoryKey, readSearchHistory, saveSearchHistory } from './search-history'
describe('scoped customer search history',()=>{
 it('isolates organizations and users',()=>{
  expect(searchHistoryKey('org-a','user-a')).not.toBe(searchHistoryKey('org-b','user-a'))
  expect(searchHistoryKey('org-a','user-a')).not.toBe(searchHistoryKey('org-a','user-b'))
 })
 it('ignores corrupted or non-string storage',()=>{
  expect(readSearchHistory({getItem:()=>'{broken'},'key')).toEqual([])
  expect(readSearchHistory({getItem:()=>JSON.stringify(['Ana',null,{},123])},'key')).toEqual(['Ana'])
 })
 it('does not crash when storage is unavailable',()=>{
  expect(readSearchHistory({getItem:()=>{throw new Error('Unavailable')}},'key')).toEqual([])
  expect(()=>saveSearchHistory({setItem:()=>{throw new Error('Unavailable')}},'key',['Ana'])).not.toThrow()
 })
})
