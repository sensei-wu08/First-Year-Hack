import { describe, expect, test } from 'vitest'
import { validateComment, validateName } from './validate'

describe('validateName', () => {
  test('empty is required', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'Name is required' })
    expect(validateName('')).toEqual({ ok: false, error: 'Name is required' })
  })
  test('trims and collapses whitespace', () => {
    expect(validateName('  Jae   den  ')).toEqual({ ok: true, value: 'Jae den' })
  })
  test('too long fails', () => {
    expect(validateName('x'.repeat(200)).ok).toBe(false)
    expect(validateName('x'.repeat(24)).ok).toBe(true)
    expect(validateName('x'.repeat(25)).ok).toBe(false)
  })
  test('emoji count as one character', () => {
    expect(validateName('\u{1F525}'.repeat(24)).ok).toBe(true)
    expect(validateName('\u{1F525}'.repeat(25)).ok).toBe(false)
  })
  test('flagged names are rejected', () => {
    expect(validateName('UGLY')).toEqual({ ok: false, error: 'Pick a different name' })
    expect(validateName('ug1y')).toEqual({ ok: false, error: 'Pick a different name' })
  })
})

describe('validateComment', () => {
  test('empty becomes null', () => {
    expect(validateComment('   ')).toBeNull()
    expect(validateComment('')).toBeNull()
  })
  test('trims and cuts to 280', () => {
    expect(validateComment('a'.repeat(400))!.length).toBe(280)
    expect(validateComment('  nice fit  ')).toBe('nice fit')
  })
  test('cuts by code point, not UTF-16 unit', () => {
    expect(Array.from(validateComment('\u{1F525}'.repeat(300))!).length).toBe(280)
  })
  test('returns cleaned text', () => {
    expect(validateComment('You look UGLY!!')).toBe('You look ****!!')
  })
})
