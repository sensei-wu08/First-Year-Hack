import { describe, expect, it } from 'vitest'
import { applyToggle, emptyReactionState, foldReactions } from './reactions'

describe('foldReactions', () => {
  it('starts every emoji at zero', () => {
    const s = foldReactions([])
    expect(s.a['🔥']).toEqual({ count: 0, mine: false })
    expect(s.b['🧊']).toEqual({ count: 0, mine: false })
    expect(foldReactions(null)).toEqual(emptyReactionState())
  })

  it('folds rows by side and emoji', () => {
    const s = foldReactions([
      { side: 'a', emoji: '🔥', count: 3, mine: true },
      { side: 'b', emoji: '👑', count: '2', mine: false },
    ])
    expect(s.a['🔥']).toEqual({ count: 3, mine: true })
    expect(s.b['👑']).toEqual({ count: 2, mine: false })
    expect(s.a['👑']).toEqual({ count: 0, mine: false })
  })

  it('ignores unknown sides and emoji', () => {
    const s = foldReactions([
      { side: 'c', emoji: '🔥', count: 9, mine: true },
      { side: 'a', emoji: '💩', count: 9, mine: true },
    ])
    expect(s).toEqual(emptyReactionState())
  })
})

describe('applyToggle', () => {
  it('switches on and off without mutating the input', () => {
    const base = emptyReactionState()
    const on = applyToggle(base, 'a', '😍')
    expect(on.a['😍']).toEqual({ count: 1, mine: true })
    expect(base.a['😍']).toEqual({ count: 0, mine: false })
    expect(on.b['😍']).toEqual({ count: 0, mine: false })
    const off = applyToggle(on, 'a', '😍')
    expect(off.a['😍']).toEqual({ count: 0, mine: false })
  })

  it("keeps other people's counts when switching off, and never goes below zero", () => {
    const s = foldReactions([{ side: 'b', emoji: '😂', count: 4, mine: true }])
    expect(applyToggle(s, 'b', '😂').b['😂']).toEqual({ count: 3, mine: false })
    const odd = foldReactions([{ side: 'b', emoji: '😂', count: 0, mine: true }])
    expect(applyToggle(odd, 'b', '😂').b['😂'].count).toBe(0)
  })
})
