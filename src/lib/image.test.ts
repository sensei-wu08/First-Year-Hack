import { expect, test } from 'vitest'
import { cameraErrorMessage } from './camera'
import { fitWithin } from './image'

test('fitWithin scales the longest edge down to 1280', () => {
  expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 })
  expect(fitWithin(3024, 4032)).toEqual({ width: 960, height: 1280 })
})

test('fitWithin never upscales', () => {
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  expect(fitWithin(1280, 720)).toEqual({ width: 1280, height: 720 })
})

test('fitWithin honours a custom max', () => {
  expect(fitWithin(2000, 1000, 500)).toEqual({ width: 500, height: 250 })
})

test('cameraErrorMessage maps DOMException names', () => {
  expect(cameraErrorMessage({ name: 'NotAllowedError' })).toBe(
    'Camera blocked. Allow camera access in your browser settings to post your fit.',
  )
  expect(cameraErrorMessage({ name: 'NotFoundError' })).toBe('No camera found on this device.')
  expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/another app/i)
  expect(cameraErrorMessage(new TypeError('mediaDevices undefined'))).toMatch(/https/i)
})

test('cameraErrorMessage has a fix-it fallback for unknown errors', () => {
  expect(cameraErrorMessage(new Error('boom'))).toMatch(/try again/i)
  expect(cameraErrorMessage(undefined)).toMatch(/try again/i)
})
