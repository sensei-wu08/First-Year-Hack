import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampLines, deliverFile, fitText, needsFreshTap, wrapText } from './shareCard'

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

describe('deliverFile', () => {
  const file = new File(['x'], 'fits-wrapped.png', { type: 'image/png' })
  const err = (name: string) => Object.assign(new Error(name), { name })
  afterEach(() => vi.unstubAllGlobals())

  it('shares when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { canShare: () => true, share })
    expect(await deliverFile(file)).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
  })

  it('treats a cancelled share as a no-op', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(err('AbortError')) })
    expect(await deliverFile(file)).toBe('cancelled')
  })

  it('rethrows NotAllowedError so the caller can ask for another tap', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(err('NotAllowedError')) })
    const caught = await deliverFile(file).catch((e: unknown) => e)
    expect(needsFreshTap(caught)).toBe(true)
  })
})
