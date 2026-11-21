import { describe, expect, test } from 'vitest'
import { cleanText } from './filter'

describe('cleanText', () => {
  test('masks blocklisted words, keeps punctuation', () => {
    expect(cleanText('You look UGLY!!')).toEqual({ text: 'You look ****!!', flagged: true })
  })
  test('catches leetspeak', () => {
    expect(cleanText('ug1y fit').text).toBe('**** fit')
    expect(cleanText('f@t jacket').text).toBe('*** jacket')
    expect(cleanText('gr0$$ shoes')).toEqual({ text: '***** shoes', flagged: true })
  })
  test('matches whole words only', () => {
    expect(cleanText('fathom this smuggled jacket')).toEqual({
      text: 'fathom this smuggled jacket',
      flagged: false,
    })
    expect(cleanText('class of 2026, great classic fit').flagged).toBe(false)
  })
  test('is case-insensitive and masks every occurrence', () => {
    expect(cleanText('Fat fat FATTY').text).toBe('*** *** *****')
  })
  test('clean text passes through unchanged', () => {
    const t = 'Love the jacket, 10/10 \u{1F525}'
    expect(cleanText(t)).toEqual({ text: t, flagged: false })
    expect(cleanText('')).toEqual({ text: '', flagged: false })
  })
})
