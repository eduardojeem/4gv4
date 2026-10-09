import { describe,expect,it } from 'vitest'
import { parseInheritedNumber } from '@/lib/agenda/booking-config'
describe('professional inherited numeric inputs',()=>{
  it('distinguishes a blank inherited value from explicit zero',()=>{
    expect(parseInheritedNumber(' ')).toBeNull()
    expect(parseInheritedNumber('0')).toBe(0)
    expect(parseInheritedNumber('40000')).toBe(40000)
  })
  it('rejects negative or non-finite values instead of silently inheriting',()=>{
    expect(()=>parseInheritedNumber('-1')).toThrow('INVALID_NUMBER')
    expect(()=>parseInheritedNumber('Infinity')).toThrow('INVALID_NUMBER')
    expect(()=>parseInheritedNumber('abc')).toThrow('INVALID_NUMBER')
  })
})
