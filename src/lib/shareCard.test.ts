import { describe, expect, it } from 'vitest'
import { clampLines, fitText, wrapText } from './shareCard'

const measure = (s: string) => s.length * 10

describe('wrapText', () => {
  it('wraps greedily at word boundaries', () => {
    expect(wrapText(measure, 'one two three four', 90)).toEqual(['one two', 'three', 'four'])
  })

  it('breaks a word that is wider than the line', () => {
    expect(wrapText(measure, 'abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('returns no lines for empty text', () => {
    expect(wrapText(measure, '   ', 100)).toEqual([])
  })
})

describe('clampLines', () => {
  it('keeps short input untouched', () => {
    expect(clampLines(['a', 'b'], 2)).toEqual(['a', 'b'])
  })

  it('cuts to the limit and adds an ellipsis', () => {
    expect(clampLines(['one', 'two,', 'three'], 2)).toEqual(['one', 'two…'])
  })
})

describe('fitText', () => {
  it('leaves text that fits', () => {
    expect(fitText(measure, 'short', 100)).toBe('short')
  })

  it('shortens with an ellipsis', () => {
    expect(fitText(measure, 'a long name here', 80)).toBe('a long…')
  })
})
