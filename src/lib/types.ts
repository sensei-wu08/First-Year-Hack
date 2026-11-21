export type Side = 'a' | 'b'
export type Outcome = 'W' | 'D' | 'L' | 'F'
export interface Member { id: string; name: string; emoji: string }
export interface Group {
  id: string
  name: string
  inviteCode: string
  adminId: string
  revealTime: string
  postDeadlineTime: string
  resultsTime: string
  battlesPerDay: number | null
  allowShareVoting: boolean
  commentsEnabled: boolean
}
export interface Season { id: string; groupId: string; number: number; startsOn: string; endsOn: string }
export interface BattleRecord {
  id: string
  groupId: string
  seasonId: string | null
  playerA: string
  playerB: string
  revealAt: Date
  postDeadline: Date
  resultsAt: Date
  closedAt: Date | null
  voidedAt: Date | null
  shareCode: string
}
export interface PostView { profileId: string; mediaPath: string; mediaUrl: string; mediaType: 'photo' | 'video' }
export interface Tally { total: number; votesA: number | null; votesB: number | null }
export interface BattleView { record: BattleRecord; posts: PostView[]; tally: Tally }
export interface BattleFacts {
  battle: BattleRecord
  mediaA: string | null
  mediaB: string | null
  votesA: number
  votesB: number
}
export type Phase = 'upcoming' | 'posting' | 'voting' | 'awaiting_results' | 'results' | 'void'
export interface BattleResult {
  battleId: string
  resolvedAt: Date
  kind: 'played' | 'forfeit' | 'void_both' | 'void'
  outcomes: Record<string, Outcome>
  points: Record<string, number>
  share: { a: number; b: number } | null
}
export interface CommentView {
  battleId: string
  side: Side
  authorName: string
  authorEmoji: string | null
  body: string
  createdAt: Date
}
export type VoteBlock = 'ok' | 'battler' | 'not_open' | 'closed' | 'already_voted' | 'not_allowed'
