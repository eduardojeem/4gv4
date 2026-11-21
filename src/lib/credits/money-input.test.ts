// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatMoneyInput, isCurrencyAmount, moneyFractionDigits, parseMoneyInput, roundMoneyToCurrency } from './money-input'

describe('money input shared by web and app', () => {
  it('reads guaraníes with dots as thousands, as the web always did', () => {
    expect(parseMoneyInput('150.000', 'PYG')).toBe(150000)
    expect(parseMoneyInput('1.500.000', 'PYG')).toBe(1500000)
    expect(parseMoneyInput(' 150000 ', 'PYG')).toBe(150000)
  })

  it('never reads a guaraní amount as cents', () => {
    for (const value of ['150,50', '1.50', '150.50', '15.00', '1.5000', '1,000'] as const) {
      expect(() => parseMoneyInput(value, 'PYG'), value).toThrow()
    }
  })

  it('rejects empty, negative, scientific and oversized amounts', () => {
    for (const value of ['', '0', '-1', '1e3', 'abc', '1000000001']) {
      expect(() => parseMoneyInput(value, 'PYG'), value).toThrow()
    }
  })

  it('accepts decimals only in currencies that have them', () => {
    expect(parseMoneyInput('1.500,25', 'USD')).toBe(1500.25)
    expect(parseMoneyInput('100.50', 'USD')).toBe(100.5)
    expect(parseMoneyInput('1.500', 'USD')).toBe(1500)
    expect(() => parseMoneyInput('100,555', 'USD')).toThrow()
  })

  it('formats what it reads', () => {
    expect(formatMoneyInput(1500000, 'PYG')).toBe('1.500.000')
    expect(formatMoneyInput(1500.4, 'PYG')).toBe('1.500')
    expect(formatMoneyInput(1500.5, 'USD')).toBe('1.500,50')
    expect(formatMoneyInput(1500, 'USD')).toBe('1.500')
    expect(parseMoneyInput(formatMoneyInput(1234567, 'PYG'), 'PYG')).toBe(1234567)
  })

  it('rounds and checks against the currency unit', () => {
    expect(moneyFractionDigits('PYG')).toBe(0)
    expect(moneyFractionDigits('USD')).toBe(2)
    expect(roundMoneyToCurrency(33333.33, 'PYG')).toBe(33333)
    expect(isCurrencyAmount(100, 'PYG')).toBe(true)
    expect(isCurrencyAmount(99999.5, 'PYG')).toBe(false)
    expect(isCurrencyAmount(99999.5, 'USD')).toBe(true)
  })
})
