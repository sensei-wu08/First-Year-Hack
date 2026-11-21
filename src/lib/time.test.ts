import { expect, test } from 'vitest'
import { addDays, atLocalTime, monthKey, mondayOf } from './time'

test('runs in Europe/London', () => {
  expect(new Date(2026, 9, 1, 9).getTimezoneOffset()).toBe(-60)
  expect(new Date(2026, 9, 26, 9).getTimezoneOffset()).toBe(0)
})

test('atLocalTime keeps wall-clock across DST', () => {
  expect(atLocalTime('2026-10-26', '09:00').getHours()).toBe(9)
  expect(atLocalTime('2026-10-24', '18:00').toISOString()).toBe('2026-10-24T17:00:00.000Z')
})

test('mondayOf / addDays / monthKey', () => {
  expect(mondayOf(new Date(2026, 10, 22, 18))).toBe('2026-11-16')
  expect(mondayOf(new Date(2026, 10, 16, 0))).toBe('2026-11-16')
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  expect(monthKey(new Date(2026, 9, 28))).toBe('2026-10')
})
