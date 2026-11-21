# Fits Implementation Plan (parallel workstreams)

> **Run from JetBrains Air.** Event rules require it: the executing session (coordinator, implementers and reviewers) must be started from JetBrains Air's **Agent Sessions**.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan, adapted to the parallel workflow in "How to execute" below. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship **Fits**, a deployed, installable (PWA) outfit-battle league for friend groups: join by link/QR, live photo capture, side-by-side voting (members and public share link), results reveal, FPL-style table, group settings, seeded history, Wrapped story cards and group chat.

**Architecture:** Vite + React + TypeScript SPA on Vercel, talking straight to Supabase (Postgres + RLS, anonymous auth, storage). There's no server code of our own: trusted rules live in a few Postgres `security definer` functions (join, post, vote, reveal, create season, leave). Everything time-based (phase, results, points, table, Outfit of the Week, Wrapped) is computed **from timestamps on page load** by pure, unit-tested TypeScript in `src/lib/`. No cron.

**Tech Stack:** Vite 6, React 18, TypeScript, react-router-dom 6, Tailwind CSS 4 (`@tailwindcss/vite`), `@supabase/supabase-js` 2, `vite-plugin-pwa`, `qrcode.react`, Vitest, `tsx` (seed script).

**Spec:** `docs/superpowers/specs/2026-11-21-fit-league-design.md`. **Design:** `docs/superpowers/design/tokens.md` + `docs/superpowers/design/screens.html` (9 mockups: Today, Capture, Vote, Results, League, Wrapped, Settings, Join, Chat).

> **User override of spec §9:** the spec says one agent works sequentially. The user has since asked for **parallel workstreams on branches**, with Sonnet implementers and an Opus review gate before each merge. This plan follows the user.

## Global Constraints

- App name **"Fits"** (`APP_NAME` in `src/brand.ts`, the PWA manifest and the page title).
- Times today: foundation merged **~13:15**. Deployed vertical slice (join, capture, vote, results, table) **~15:00**. Wave 2 **15:00–17:00**. **Feature freeze 17:00.** Rehearsal, backup video and submission draft **17:00–17:30**. Hard deadline **18:00**. Live demo **18:10**.
- Hackathon battle (custom times): reveal ~15:00, **post by 15:30, results 17:00**. Judging battle: open until the demo. Set results at **18:30**; the presenter uses "Reveal results now" at about 18:12.
- **Cut order if behind:** Chat first, then season lifecycle (S7 part b), then personal Wrapped, then group Wrapped. The slice and the PWA are never cut.
- **Live capture only:** `getUserMedia` in the app. Never `<input type="file">`, never a gallery picker.
- **Tone rule: "Roast the outfit, never the person."** All user text passes `cleanText`. Comments and chat have a Report button.
- Scoring: Win **3**, Draw **1**, Loss **0**, Forfeit **−1**, Outfit of the Week **+2**. Zero votes = draw. Only one posted: poster +3, no-show −1. Neither posted: both −1, battle void.
- Outfit of the Week: highest **vote share**, Monday–Sunday week, **≥ 3 votes**, forfeit wins don't qualify, ties all get +2, awarded at Sunday's results time.
- Table sort: **points, then win %, then name**. Columns: rank (arrow since last results), name, played, W–D–L, win %, points.
- Defaults: reveal **09:00**, post by **12:00**, results **18:00**, share-link voting **off**, comments **on**.
- Round-robin up to **14** members; default battles/day = `ceil(total / 28)`. Over 14: 15–25 → 2, 26–40 → 3, 41+ → 4. Nobody battles twice on one day.
- Battlers can't vote in their own battle. One vote per person (or per browser, for share voters) per battle. Votes are anonymous; comments show names.
- Personal Wrapped is always monthly (calendar month). Wrapped cards are **9:16**, tap to advance.
- **Auth:** Supabase **anonymous sign-ins** plus a `profiles` row (name + emoji). Joining is one screen, one tap.
- **Schema:** versioned `.sql` files in `supabase/migrations/`, applied by a **human pasting them into the Supabase SQL Editor**. No Supabase CLI.
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored) and in Vercel. The service-role key exists only in the gitignored `.env.seed.local`.
- **UI:** build every screen from `docs/superpowers/design/` (tokens + matching mockup in `screens.html`). Colours and fonts come only from `src/styles/theme.css` tokens. No raw hex values in `.tsx` files, no new fonts. Sentence case, and button copy that says exactly what happens. The only orchestrated motion is the results reveal, which respects `prefers-reduced-motion`.
- All times are device-local (Europe/London). Vitest runs with `TZ=Europe/London`.
- Tests stay proportionate: unit tests for `src/lib/` only, no end-to-end framework. UI is verified by hand at the listed steps.
- Every branch keeps `npm test` and `npm run build` green.

## Review Focus

1. **Eduroam NAT and anonymous sign-in rate limits.** The whole room shares one public IP, and Supabase's default anonymous sign-in limit (about 30 an hour per IP) would silently block share voters. Expected: dozens of votes from the room. Pinned by manual step M0.4 and the slice check M2 (3+ devices on venue Wi-Fi).
2. **"Reveal results now" during posting, and boundary instants.** Expected: an early close with one post resolves as a forfeit (poster +3, no-show −1), and `now === resultsAt` counts as resolved. Pinned by S1 tests `resolves early close during posting as forfeit` and `boundary instants`.
3. **Seasons crossing the clocks change** (UK DST ends 25 Oct 2026, inside the seeded October season). Expected: 09:00 local every day. Pinned by S2 test `keeps local times across DST`.
4. **Camera failures:** denied, no camera, camera in use, or http. Expected: a fix-it message (tokens.md copy voice) and Retry, never a blank screen and never a gallery fallback. Pinned by S4 test `cameraErrorMessage maps DOMException names`.
5. **Messy text:** whitespace or 200-character names, emoji names, blocklisted words in mixed case, with punctuation or in leetspeak. Expected: names trimmed to 1–24 characters (emoji count as one), empty comments become null, and flagged words are masked. Pinned by S1 tests in `filter.test.ts` and `validate.test.ts`.

---

## Decisions made for the builder (spec §10 and gaps)

- **Scheduled events:** computed from timestamps (`battlePhase`, `resolveAll`). "Reveal results now" sets `battles.closed_at`.
- **Live updates:** battle pages **poll every 5 s** instead of using Supabase Realtime. Realtime can't deliver rows that RLS hides from share voters, and polling copes better with eduroam.
- **Vote secrecy:** the `battle_tallies` view always returns `total` (for "X people voted"), but `votes_a`/`votes_b` and comments only after close.
- **Comments** are stored on the vote row. A comment's side (its author's vote) is used only to pick "comment of the season" and "best comment about you". The UI never shows a side next to a name. Share voters without a profile show as **"Guest"**, and the share page has an optional "Your name" field.
- **Word filter:** client-side blocklist that masks matches (`cleanText`). The server only limits length (280).
- **Photos:** JPEG, longest edge **1280 px**, quality **0.8**, in the public bucket `outfits` at path `{uid}/{battleId}.jpg`. One post per battler, no retake.
- **Table scope:** the current season. A group with no season (the hackathon group) uses all its custom battles. Forfeit counts as played and lost. A void-both battle isn't played but still gives −1. Win % = round(100·W/P), and 0 when P = 0.
- **Rank arrows:** compare against the table without the latest resolution instant.
- **Personal Wrapped month rank:** the table built from the group's battles resolved in that month. Default month = the previous complete month (October 2026).
- **Seed:** `scripts/seed.ts --me <uid>` makes the presenter's own anonymous profile one of the 8 members of "The Fit Crew", so the presenter's phone shows real personal Wrapped.
- **Share voting during the slice:** until S7 (Settings) merges, a human flips `groups.allow_share_voting` in the Supabase Table Editor.
- **Nav (tokens.md):** sticky bottom nav **Today** (`/g/:id`), **League** (`/g/:id/table`), **Chat** (`/g/:id/chat`), **Group** (`/g/:id/settings`: settings, members, invite, Wrapped links).

---

## How to execute (parallel workflow and merge gate)

**Roles:** a **coordinator** session (started from JetBrains Air) creates branches, dispatches subagents, runs the gate and merges. **Implementers** are Sonnet subagents, one per workstream. **Reviewers** are Opus subagents, fresh for each review. **Humans** do the steps marked HUMAN.

**Per workstream:**
1. **Branch:** `git worktree add "../fits-<stream>" -b feat/<stream> main` (or the Agent tool with `isolation: "worktree"`). In the worktree, run `npm ci` and copy `.env.local` in. Parallel agents **must** use separate worktrees, never the shared checkout.
2. **Implement (Sonnet):** give the agent the spec path, `docs/superpowers/design/`, Global Constraints and its own workstream section. It edits **only its owned files** (plus listed touchpoints), follows its steps, and commits on the branch.
3. **Sync with main before review:** `git fetch origin && git rebase main`. If the rebase hits conflicts outside owned files, `git rebase --abort && git merge main`, resolve, then run `npm ci && npm test && npm run build`. All must pass.
4. **Review (Opus):** give the reviewer the spec, Global Constraints, the workstream section, the owned-file list and `git diff main...feat/<stream>`. Checklist:
   - Behaviour and values match the spec and this section; interfaces match the names and types here exactly.
   - No files changed outside owned files and listed touchpoints (`git diff --name-only main...feat/<stream>`).
   - Tests exist where listed, assert the spec's values, and pass.
   - UI matches the mockup and tokens. `git grep -nE "#[0-9a-fA-F]{3,8}\b" -- "src/**/*.tsx"` is empty, and `git grep -n 'type="file"' src` is empty.
   - No secrets committed, nothing that breaks `npm run build`.
   - Verdict: **PASS** or **CHANGES REQUIRED** with `file:line` findings. The implementer fixes and the reviewer re-reviews. After 2 failed rounds the coordinator decides.
5. **Merge** (coordinator, only after PASS and green tests): `git switch main && git pull --ff-only && git merge --no-ff feat/<stream> -m "merge: feat/<stream>"`, then `npm ci && npm test && npm run build` on main, then `git push origin main` (Vercel deploys), then `git worktree remove "../fits-<stream>"`. Then do the stream's HUMAN post-merge steps.
6. **Every other open branch** re-syncs with main (step 3) before its own review.

**Shared touchpoints (to prevent merge conflicts):**
- **Router (`src/App.tsx`) and nav (`src/components/AppShell.tsx`, `BottomNav.tsx`):** S0 writes the full route table and nav pointing at stub page files. Workstreams **never edit them**. They replace the body of their own stub page files. If a new route is truly needed, the coordinator adds it on main.
- **Cross-stream components and modules:** S0 creates them as **stubs with final signatures**. The owning stream replaces the body without changing the export signature: `PostPanel` (S4), `InviteQr` (S3), `ReportButton` (S5), `src/lib/phase.ts`, `scoring.ts`, `filter.ts`, `validate.ts` (S1), `src/data/lifecycle.ts` (S7). Stubs throw `notImplemented()`, except `PostPanel`, `InviteQr`, `ReportButton` and `onGroupLoad`, which render `null` or do nothing. Streams that consume an S1 stub rebase after S1 merges, before their manual checks.
- **`src/lib/types.ts`, `src/data/reads.ts`, `src/data/mappers.ts`, `src/data/auth.ts`, `src/styles/theme.css`:** S0 owns these, and workstreams don't edit them. New types go in the stream's own module (exported from there). A required change to a shared file goes to the coordinator, who makes it on main, and open branches re-sync.
- **`package.json` / lockfile:** S0 installs every dependency the whole plan needs. Workstreams don't add dependencies. If one is unavoidable, the coordinator adds it on main.
- **SQL:** S0's `0001_init.sql` holds the **entire** schema (including chat, seasons and lifecycle RPCs). A stream that needs a schema change adds its own `supabase/migrations/000N_<stream>.sql`. Never edit 0001 after it has been run.
- **`vite.config.ts`, `index.html`:** S0 owns them, then S6 (PWA) is the only stream that edits them afterwards.

## Waves, merge order and timeline (now ≈ 12:55)

| Wave | Streams (branch) | Est. agent time | Merge order | Clock |
|---|---|---|---|---|
| 0 | **S0 foundation** (on `main`, sequential) | 20–25 m | n/a | 12:55 → **~13:15**. HUMAN: M1 SQL + Vercel import right after |
| 1 (slice) | S1 `feat/core-logic`, S2 `feat/scheduler-lib`, S3 `feat/join-groups`, S4 `feat/capture-post`, S5 `feat/voting-results`, S6a `feat/scoring-table` | 15 / 20 / 35 / 25 / 40 / 30 m | **S1 → S3 → S4 → S5 → S6a → S2** (S2 whenever it passes; it touches nothing else) | 13:15 → merges 13:45–14:40 → **slice check M2 14:40–15:00** |
| 2 (15:00–17:00) | S6 `feat/pwa-deploy`, S8 `feat/seed-data`, S7 `feat/settings-scheduler`, S9 `feat/wrapped`, S10 `feat/chat` | 20 / 30 / 35 / 45 / 15 m | **S6 → S8 → S7 → S9 → S10** | merges 15:30–16:45. Phones tested 16:30–16:50 |
| freeze | none (bug fixes only, same gate, reviewer may be brief) | | | 17:00 |

Wave 2 streams may **start** as soon as their dependencies are on main (S8 and S9 need only S2 and S6a). They are **merged** only after the whole of Wave 1 is merged.

## File Structure and ownership

```
S0  package.json, vite.config.ts, tsconfig*.json, index.html, vercel.json, .env.example, .gitignore
S0  src/main.tsx, src/App.tsx, src/brand.ts, src/styles/theme.css
S0  src/lib/types.ts, src/lib/time.ts(+test), src/lib/notImplemented.ts
S0  src/data/supabase.ts, auth.ts, reads.ts, mappers.ts, lifecycle.ts(stub→S7)
S0  src/components/AppShell.tsx, BottomNav.tsx, GroupLayout.tsx, RequireProfile.tsx, Avatar.tsx, PhaseBadge.tsx, Placeholder.tsx
S0  stubs: src/components/PostPanel.tsx(→S4), InviteQr.tsx(→S3), ReportButton.tsx(→S5); src/lib/phase.ts, scoring.ts, filter.ts, validate.ts(→S1); every src/pages/*.tsx (→ owner below)
S0  supabase/migrations/0001_init.sql
S1  src/lib/phase.ts, scoring.ts, filter.ts, blocklist.ts, validate.ts (+ *.test.ts)
S2  src/lib/rng.ts, scheduler.ts (+ test)
S3  src/data/groups.ts; src/components/InviteQr.tsx; src/pages/Home.tsx, Onboard.tsx, CreateGroup.tsx, Join.tsx, Me.tsx, Today.tsx, NewBattle.tsx
S4  src/lib/image.ts, camera.ts (+ test); src/data/posts.ts; src/components/Camera.tsx, PostPanel.tsx
S5  src/data/votes.ts; src/components/VoteSplit.tsx, VersusSeam.tsx, ResultsReveal.tsx, CommentList.tsx, ReportButton.tsx; src/pages/Battle.tsx, ShareVote.tsx
S6a src/lib/ootw.ts, table.ts (+ tests); src/components/LeagueTable.tsx; src/pages/League.tsx
S6  vite.config.ts (PWA plugin only), index.html (meta only), public/icons/*, src/pages/MockNotify.tsx
S7  src/data/seasons.ts, src/data/lifecycle.ts; src/pages/Settings.tsx; supabase/migrations/0002_settings.sql (only if needed)
S8  scripts/seed.ts, seed/photos/.gitkeep
S9  src/lib/wrapped.ts (+ test); src/data/wrapped.ts; src/components/StoryCards.tsx; src/pages/GroupWrapped.tsx, PersonalWrapped.tsx
S10 src/data/chat.ts; src/pages/Chat.tsx
```

**Routes (S0, final):** `/` Home · `/onboard` · `/new` CreateGroup · `/j/:code` Join · `/me` Me · `/me/wrapped/:month` PersonalWrapped · `/b/:battleId` Battle · `/v/:shareCode` ShareVote · `/demo/notify` MockNotify · `/g/:groupId` (GroupLayout with BottomNav) → index Today · `table` League · `chat` Chat · `settings` Settings · `new-battle` NewBattle · `wrapped/:seasonId` GroupWrapped.

---

## Manual steps (HUMAN)

**M0: before/during S0 (about 15 min)**
- [ ] **M0.1** Create a Supabase project (London `eu-west-2`). Note the Project URL, the anon key and the service_role key.
- [ ] **M0.2** Authentication → Sign In / Providers: **enable "Allow anonymous sign-ins"**, with CAPTCHA off.
- [ ] **M0.3** Write `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and `.env.seed.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Both are gitignored, and neither is ever committed.
- [ ] **M0.4** Authentication → Rate Limits: raise **anonymous sign-ins per hour** to the maximum (Review Focus 1).
- [ ] **M0.5** Teammates: seed photos (8 people with consent, about 4 each, saved to `seed/photos/*.jpg` in the main checkout), plus a 512 px app icon in the Fits palette.

**M1: right after S0 is pushed (about 10 min)**
- [ ] **M1.1** Paste `supabase/migrations/0001_init.sql` into the Supabase **SQL Editor** → Run. Expected: "Success. No rows returned". Check: `select * from battle_tallies limit 1;` runs, and Storage shows the public bucket `outfits`.
- [ ] **M1.2** Vercel → Add New Project → **import the GitHub repo** `sensei-wu08/First-Year-Hack` (preset Vite). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production + Preview). Deploy, then open the URL on a phone and see the Fits shell.

**M2: slice check, 14:40–15:00, on production, 3+ phones (iOS + Android), venue Wi-Fi**
- [ ] Create the hackathon group, join by QR on 3 phones, create a custom battle (reveal ~15:00, **post by 15:30, results 17:00**), and have both battlers post. Set `allow_share_voting = true` in the Table Editor. Vote from 3+ devices including one non-member. Test "Reveal results now" on a throwaway battle and check every phone shows the result within about 5 s, and the League tab updates. **Then give the hackathon battle's share link out** (Discord, the room).

**M3: Wave 2 checks**
- [ ] After S6: install the app on iPhone (Safari → Share → Add to Home Screen) and Android. It opens full-screen, and **the camera works in standalone mode**.
- [ ] After S8: copy the uid from `/me` on the presenter's phone and run `npm run seed -- --me <uid> --reset`. The League tab shows Season 2 with arrows.
- [ ] By 16:50: create the **judging battle** (results 18:30, share voting on), with the share QR ready on a second phone.

**M4: 17:00–17:30**
- [ ] Rehearse the spec §7 run twice (seeded group + Wrapped open in a second tab or device, hotspot ready). Record the backup video. Draft the MLH submission by 17:30 and submit before 18:00.

---

## S0: Foundation (main, sequential, ~20–25 min). CRITICAL PATH

Keep it minimal: no feature logic beyond what's listed. **Before writing UI, read `docs/superpowers/design/tokens.md` and open `screens.html`.**

**Interfaces (Produces, used by every stream):**
```ts
// src/brand.ts
export const APP_NAME = 'Fits';
export const TAGLINE = '1v1 your friends in a fashion battle. Every day. All season.';
export const TONE_RULE = 'Roast the outfit, never the person.';
// src/lib/types.ts
export type Side = 'a' | 'b';
export type Outcome = 'W' | 'D' | 'L' | 'F';
export interface Member { id: string; name: string; emoji: string }
export interface Group { id: string; name: string; inviteCode: string; adminId: string; revealTime: string;
  postDeadlineTime: string; resultsTime: string; battlesPerDay: number | null; allowShareVoting: boolean; commentsEnabled: boolean }
export interface Season { id: string; groupId: string; number: number; startsOn: string; endsOn: string }
export interface BattleRecord { id: string; groupId: string; seasonId: string | null; playerA: string; playerB: string;
  revealAt: Date; postDeadline: Date; resultsAt: Date; closedAt: Date | null; voidedAt: Date | null; shareCode: string }
export interface PostView { profileId: string; mediaPath: string; mediaUrl: string; mediaType: 'photo' | 'video' }
export interface Tally { total: number; votesA: number | null; votesB: number | null }
export interface BattleView { record: BattleRecord; posts: PostView[]; tally: Tally }
export interface BattleFacts { battle: BattleRecord; mediaA: string | null; mediaB: string | null; votesA: number; votesB: number }
export type Phase = 'upcoming' | 'posting' | 'voting' | 'awaiting_results' | 'results' | 'void';
export interface BattleResult { battleId: string; resolvedAt: Date; kind: 'played' | 'forfeit' | 'void_both' | 'void';
  outcomes: Record<string, Outcome>; points: Record<string, number>; share: { a: number; b: number } | null }
export interface CommentView { battleId: string; side: Side; authorName: string; authorEmoji: string | null; body: string; createdAt: Date }
export type VoteBlock = 'ok' | 'battler' | 'not_open' | 'closed' | 'already_voted' | 'not_allowed';
// src/lib/time.ts
atLocalTime(date: string, hhmm: string): Date; localDateKey(d: Date): string; addDays(date: string, n: number): string;
mondayOf(d: Date): string; monthKey(d: Date): string;
// src/data/auth.ts
ensureSession(): Promise<string>; // signInAnonymously() if no session; returns uid
useProfile(): { uid: string | null; profile: Member | null; loading: boolean; refresh(): void };
upsertProfile(name: string, emoji: string): Promise<Member>;
// <RequireProfile> redirects to /onboard?next=<path> when there's no profile
// src/data/reads.ts (all throw Error(message) on a Supabase error)
getGroup(id: string): Promise<Group>; listMembers(groupId: string): Promise<(Member & { leftAt: Date | null })[]>;
listBattles(groupId: string, seasonId?: string | null): Promise<BattleView[]>; getBattle(id: string): Promise<BattleView | null>;
currentSeason(groupId: string): Promise<Season | null>; listSeasons(groupId: string): Promise<Season[]>;
publicUrl(path: string): string;
// src/data/mappers.ts
toFacts(v: BattleView): BattleFacts; postedOf(v: BattleView): { a: boolean; b: boolean };
// src/data/lifecycle.ts (stub → S7): onGroupLoad(group: Group, members: Member[]): Promise<void>  // stub: resolves
// Stubs with final signatures (bodies: throw notImplemented('<name>')):
// phase.ts:   closeAt(b: BattleRecord): Date; battlePhase(b: BattleRecord, posted: {a: boolean; b: boolean}, now: Date): Phase;
//             voteEligibility(a: { phase: Phase; viewerId: string; battle: BattleRecord; isMember: boolean; shareVotingAllowed: boolean; alreadyVoted: boolean }): VoteBlock
// scoring.ts: scoreBattle(f: BattleFacts, now: Date): BattleResult | null; resolveAll(facts: BattleFacts[], now: Date): BattleResult[]
// filter.ts:  cleanText(input: string): { text: string; flagged: boolean }
// validate.ts: validateName(raw: string): { ok: true; value: string } | { ok: false; error: string }; validateComment(raw: string): string | null
// Component stubs (render null): PostPanel({ view, viewerId, onPosted }: { view: BattleView; viewerId: string; onPosted(): void });
//   InviteQr({ url, label }: { url: string; label: string }); ReportButton({ battleId, messageId }: { battleId?: string; messageId?: string })
```

**Schema (`supabase/migrations/0001_init.sql`; all `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()` unless noted):**
- `profiles(id uuid pk references auth.users on delete cascade, name, emoji)`
- `groups(name, invite_code unique default substr(md5(random()::text),1,8), admin_id → profiles, reveal_time text '09:00', post_deadline_time '12:00', results_time '18:00', battles_per_day int null, allow_share_voting bool false, comments_enabled bool true)`
- `memberships(group_id, profile_id, joined_at, left_at null, pk(group_id, profile_id))`
- `seasons(group_id, number, starts_on date, ends_on date, unique(group_id, number))`
- `battles(group_id, season_id null, player_a, player_b, reveal_at, post_deadline, results_at, closed_at null, voided_at null, share_code unique default substr(md5(random()::text),1,10), check(player_a <> player_b))`
- `posts(battle_id, profile_id, media_path, media_type default 'photo' check in ('photo','video'), pk(battle_id, profile_id))`
- `votes(battle_id, voter_id → auth.users, side check in ('a','b'), comment null check(char_length ≤ 280), pk(battle_id, voter_id))`
- `messages(group_id, author_id default auth.uid(), body check(char_length between 1 and 500))`
- `reports(reporter_id default auth.uid(), battle_id null, message_id null, reason)`
- `is_member(gid) returns bool` (security definer, stable; active membership of `auth.uid()`).
- RLS: profiles select for authenticated, insert/update own. groups select if member, update if admin. memberships, seasons, posts, messages select if member. messages insert if member and own author. battles select if member, insert/update if group admin. votes select own only (no direct insert). reports insert own.
- Views (owner rights, `grant select to authenticated`, rows only for `is_member(group_id)`): `battle_tallies(battle_id, total, votes_a, votes_b)`, where the splits are null until `now() >= least(results_at, coalesce(closed_at, results_at))`. `battle_comments(battle_id, side, author_name = coalesce(profile name,'Guest'), author_emoji, body, created_at)`, closed battles only.
- RPCs (`security definer`, `set search_path = public`, granted to authenticated; errors raise exactly the quoted code):
  - `create_group(p_name) → uuid`: also adds the admin's membership.
  - `group_by_invite(p_code) → table(id, name, member_count)`.
  - `join_group(p_code) → uuid`: upsert, clears `left_at`. Error `'bad_code'`.
  - `submit_post(p_battle, p_path, p_type)`: errors `'not_player'`, `'not_open'` (before reveal, or closed/voided), `'too_late'` (`now() >= post_deadline`).
  - `cast_vote(p_battle, p_side, p_comment)`: errors `'battler'`, `'not_allowed'` (not a member and share voting off), `'not_open'` (< 2 posts), `'closed'`, `'already_voted'`. The comment is nulled when comments are disabled.
  - `reveal_now(p_battle)`: admin only (`'not_admin'`). Sets `closed_at = now()` if it's null.
  - `battle_by_share_code(p_code) → jsonb`: null unless `allow_share_voting`. Returns `{battle, group:{name, comments_enabled}, players:[{id,name,emoji}], posts:[{profile_id,media_path,media_type}], tally:{total,votes_a,votes_b}, comments:[...]}` with the same close rules.
  - `create_season(p_group, p_starts date, p_ends date, p_battles jsonb) → uuid`: admin any time, or any member when the latest season's `ends_on < current_date`. Otherwise `'season_active'`. Number = max + 1.
  - `leave_group(p_group)`: sets `left_at = now()`, and `voided_at = now()` on the caller's unresolved battles in that group.
- Storage: public bucket `outfits`. Insert policy: authenticated, with `(storage.foldername(name))[1] = auth.uid()::text`. The seed uses the service role for `seed/…`.

**Steps:**
- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts` (keep LICENSE, Team.md, docs). Install **all** project dependencies: `react-router-dom@6 @supabase/supabase-js@2 qrcode.react`. Dev: `tailwindcss @tailwindcss/vite vitest tsx vite-plugin-pwa`. Scripts: `test: vitest run`, `seed: tsx scripts/seed.ts`. In `vite.config.ts`, add the react and tailwind plugins and `test: { environment: 'node', env: { TZ: 'Europe/London' } }`. `vercel.json`: SPA rewrite of `/(.*)` → `/index.html`. `.gitignore`: add `.env.local`, `.env.seed.local`, `dist`, `*.pptx`, `STUDENT_GUIDE.pdf`, `seed/photos/*.jpg`. `.env.example` lists the two `VITE_` vars.
- [ ] **Step 2: Theme from the design folder.** In `index.html`, add the Google Fonts link for **Unbounded 600/800** and **Plus Jakarta Sans 400/600/700/800**, `<title>Fits</title>`, and `theme-color #5B34F2`. `src/styles/theme.css`: `@import "tailwindcss";` plus a `@theme` block mapping every `tokens.md` colour (`--color-ink #170B3B`, `--color-white #FFFFFF`, `--color-violet #5B34F2`, `--color-lavender #B9A4FF`, `--color-lime #D6FF4F`, `--color-pink #FF4FA0`, `--color-sky #47C6FF`, `--color-tangerine #FF8A2A`, `--color-mint #5BE3B0`, `--color-down #FF5C5C`; `home` = pink, `away` = sky), the fonts (`--font-display` Unbounded, `--font-body` Plus Jakarta Sans), the radii (tile 28, photo 24, input 16, pill) and the type scale (12/13/15/16/18/20/28/84/132). Add a comment at the top: "Source of truth: docs/superpowers/design/tokens.md. Change values here only." Body: `bg-violet text-white font-body`. Bottom nav is an ink pill floating above the bottom edge, with the active tab as a lime pill.
- [ ] **Step 3: Write the failing test** `src/lib/time.test.ts`:
```ts
test('runs in Europe/London', () => {
  expect(new Date(2026, 9, 1, 9).getTimezoneOffset()).toBe(-60);
  expect(new Date(2026, 9, 26, 9).getTimezoneOffset()).toBe(0);
});
test('atLocalTime keeps wall-clock across DST', () => {
  expect(atLocalTime('2026-10-26', '09:00').getHours()).toBe(9);
  expect(atLocalTime('2026-10-24', '18:00').toISOString()).toBe('2026-10-24T17:00:00.000Z');
});
test('mondayOf / addDays / monthKey', () => {
  expect(mondayOf(new Date(2026, 10, 22, 18))).toBe('2026-11-16');
  expect(mondayOf(new Date(2026, 10, 16, 0))).toBe('2026-11-16');
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(monthKey(new Date(2026, 9, 28))).toBe('2026-10');
});
```
- [ ] **Step 4:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 5:** Implement `time.ts` (local `Date` constructors only), `types.ts`, `notImplemented.ts`, `supabase.ts`, `auth.ts`, `reads.ts` (battles query: `select('*, posts(*)')` plus a second query on `battle_tallies` for the ids, merged in JS), `mappers.ts`, and the `lifecycle.ts` stub.
- [ ] **Step 6:** Create `App.tsx` with the full route table, `AppShell`, `GroupLayout` (loads the group and members, calls `onGroupLoad`, renders `<Outlet/>` + `BottomNav`), and `BottomNav` (Today, League, Chat, Group, styled per the mockup's sticky nav). Add `RequireProfile`, `Avatar` (emoji in a circle) and `PhaseBadge` (`{ phase: Phase }` → label: "Match revealed at …" is the caller's job; badge labels "Posting", "Voting open", "Results", "Waiting for results", "Upcoming", "Void"). Create all stub components, stub lib modules and stub pages (`<Placeholder name="Today" />`).
- [ ] **Step 7:** Write `supabase/migrations/0001_init.sql` to the schema above (`create … if not exists`, `create or replace function`).
- [ ] **Step 8:** Run `npm test && npm run build`. Expected: PASS and build OK. `npm run dev` shows the Fits shell with the bottom nav on `/g/x`.
- [ ] **Step 9: Commit on main** `chore: foundation (scaffold, types, schema, data layer, routing shell, Fits theme)` and push. **Trigger M1.** No Opus gate on S0 because of the critical path. The coordinator skims the diff against this section before pushing.

---

## Wave 1: vertical slice (branches from main after S0)

### S1 `feat/core-logic`: phase, scoring, filter, validation (pure, ~15 min). Merges first.

**Owns:** `src/lib/phase.ts`, `scoring.ts`, `filter.ts`, `blocklist.ts`, `validate.ts`, and their `*.test.ts`. **Depends on:** S0. **Interfaces:** replaces the S0 stub bodies; signatures are unchanged (see S0).

Rules: `closeAt` = `closedAt` if earlier than `resultsAt`, else `resultsAt`. Phase order: `voidedAt` → `'void'`; `now < revealAt` → `'upcoming'`; `now >= closeAt` → `'results'`; both posted → `'voting'`; `now < postDeadline` → `'posting'`; else `'awaiting_results'`. Eligibility order: battler, not_allowed (not a member and share off), closed (phase results/void), not_open (phase ≠ voting), already_voted, ok. `resolveAll` returns non-null results sorted by `resolvedAt` asc. `share` is null unless kind `played` and total > 0. `cleanText`: whole-word, case-insensitive match after normalising leetspeak (`0→o 1→i 3→e 4→a @→a $→s`) for comparison only; replace the original word with `*` × its length. `BLOCKLIST` starts with appearance and body insults (`ugly`, `fat`, `fatty`, `skinny`, `gross`, …) plus common slurs and profanity. `validateName`: trim, collapse whitespace, 1–24 characters by `Array.from`, empty → `'Name is required'`, flagged → `'Pick a different name'`. `validateComment`: trim, empty → null, cut to 280, return the cleaned text.

- [ ] **Step 1: Write failing tests** (fixture `mk()` = reveal 09:00, deadline 12:00, results 18:00 on 2026-11-21, players `'A'`/`'B'`):
  - `phase.test.ts`: `upcoming before reveal`, `posting after reveal with one post`, `voting as soon as both posted (10:30)`, `awaiting_results after deadline with one post`, `results at exactly resultsAt` (1 ms earlier → `'voting'`), `early closedAt makes results`, `voided wins over everything`. Eligibility: battler A → `'battler'` even with share on; non-member with share off → `'not_allowed'`; non-member with share on during voting → `'ok'`; member during posting → `'not_open'`; already voted → `'already_voted'`.
  - `scoring.test.ts`:
```ts
test('5-3 win', () => { const r = scoreBattle(facts({ votesA: 5, votesB: 3 }), after)!;
  expect(r.points).toEqual({ A: 3, B: 0 }); expect(r.outcomes).toEqual({ A: 'W', B: 'L' }); expect(r.share).toEqual({ a: 0.625, b: 0.375 }); });
// '4-4 draw' {A:1,B:1}; '0-0 with both posted is a draw' {A:1,B:1}, share null
// 'only A posted: A wins 3, B forfeits -1' kind 'forfeit', outcomes {A:'W',B:'F'}
// 'neither posted: both -1, void_both' outcomes {A:'F',B:'F'}; 'voidedAt: kind void, no points' points {}
// 'not resolved before close returns null'
// 'resolves early close during voting' closedAt 15:00, 2-1 → A W, resolvedAt 15:00
// 'resolves early close during posting as forfeit' closedAt 11:00, only B posted → {A:-1,B:3}
// 'boundary instants' now === resultsAt → resolved
```
  - `filter.test.ts` / `validate.test.ts`:
```ts
expect(cleanText('You look UGLY!!')).toEqual({ text: 'You look ****!!', flagged: true });
expect(cleanText('ug1y fit').text).toBe('**** fit');
expect(cleanText('fathom this smuggled jacket').flagged).toBe(false);
expect(validateName('   ')).toEqual({ ok: false, error: 'Name is required' });
expect(validateName('  Jae   den  ')).toEqual({ ok: true, value: 'Jae den' });
expect(validateName('x'.repeat(200)).ok).toBe(false);
expect(validateName('🔥'.repeat(24)).ok).toBe(true);
expect(validateComment('   ')).toBeNull();
expect(validateComment('a'.repeat(400))!.length).toBe(280);
```
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (`notImplemented`).
- [ ] **Step 3:** Implement the five modules.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lib): battle phase, eligibility, scoring, word filter and validation`. Then the gate.

### S2 `feat/scheduler-lib`: round-robin scheduler (pure, ~20 min)

**Owns:** `src/lib/rng.ts`, `src/lib/scheduler.ts`, `src/lib/scheduler.test.ts`. **Depends on:** S0 (`time.ts`).

**Interfaces (Produces, for S7 and S8):**
```ts
export function mulberry32(seed: number): () => number;
export function shuffle<T>(xs: T[], rng: () => number): T[];            // copy, Fisher–Yates
export interface DayTimes { reveal: string; postDeadline: string; results: string }
export interface ScheduledBattle { playerA: string; playerB: string; date: string; revealAt: Date; postDeadline: Date; resultsAt: Date }
export function defaultBattlesPerDay(memberCount: number): number;      // Global Constraints values; 0 when < 2
export function scheduleSeason(a: { memberIds: string[]; startDate: string; battlesPerDay: number; times: DayTimes; rng: () => number }): ScheduledBattle[];
export function redateRemaining(a: { battles: { id: string; playerA: string; playerB: string }[]; fromDate: string; battlesPerDay: number; times: DayTimes }):
  { id: string; date: string; revealAt: Date; postDeadline: Date; resultsAt: Date }[];
```
Algorithm: shuffle members, then the circle method (add a bye for an odd count, drop bye pairs), then shuffle the round order and the pairs within each round, then `packIntoDays`. `packIntoDays(pairs, perDay)` (internal, greedy): for each day, take pairs from the front of the queue whose players aren't used that day, until `perDay` are taken or none fit. Always progresses. `redateRemaining` re-packs in the given order from `fromDate`.

- [ ] **Step 1: Write failing tests:**
```ts
expect([2,3,8,10,12,14,15,25,26,40,41].map(defaultBattlesPerDay)).toEqual([1,1,1,2,3,4,2,2,3,3,4]);
expect(defaultBattlesPerDay(1)).toBe(0);
// '8 members: 28 battles, every pair once, 28 consecutive days from startDate'
// '7 members: 21 battles with a bye'
// '10 members at 2/day: nobody twice on a day' (45 battles)
test('keeps local times across DST', () => { const s = scheduleSeason({ memberIds: eight, startDate: '2026-10-01', battlesPerDay: 1,
  times: { reveal: '09:00', postDeadline: '12:00', results: '18:00' }, rng: mulberry32(1) });
  expect(s.every(b => b.revealAt.getHours() === 9 && b.resultsAt.getHours() === 18)).toBe(true); });
// 'same seed same schedule, different seed different order'
// 'redateRemaining keeps pairs and order, re-dates from fromDate at new times'
```
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lib): shuffled round-robin scheduler`. Then the gate.

### S3 `feat/join-groups`: onboarding, groups, join, Today feed, custom battles (~35 min)

**Owns:** `src/data/groups.ts`, `src/components/InviteQr.tsx`, `src/pages/Home.tsx`, `Onboard.tsx`, `CreateGroup.tsx`, `Join.tsx`, `Me.tsx`, `Today.tsx`, `NewBattle.tsx`. **Depends on:** S0; S1 for manual checks (`validateName`, `battlePhase`). **Design:** mockups **8 JOIN** and **1 TODAY**.

**Interfaces:**
- Consumes: `ensureSession`, `useProfile`, `upsertProfile`, `getGroup`, `listMembers`, `listBattles`, `listSeasons`, `battlePhase`, `postedOf`, `validateName`, `atLocalTime`.
- Produces (`groups.ts`): `createGroup(name: string): Promise<string>`, `getGroupByInvite(code: string): Promise<{ id: string; name: string; memberCount: number } | null>`, `joinGroup(code: string): Promise<string>`, `listMyGroups(): Promise<Group[]>`, `createCustomBattle(i: { groupId: string; playerA: string; playerB: string; revealAt: Date; postDeadline: Date; resultsAt: Date }): Promise<string>`.
- `InviteQr({ url, label })`: `QRCodeSVG` in ink on white, plus pill buttons "Copy link" and "Share" (`navigator.share` when available).

- [ ] **Step 1:** Implement `groups.ts` and `InviteQr`.
- [ ] **Step 2:** `Onboard`: name input and a 16-emoji grid, validated. Submit → `upsertProfile` → `?next=` or `/`. `Join` (`/j/:code`): group name and member count. If there's no profile, the name and emoji fields are inline, so it's **one screen, one tap** ("Join <group>"). A bad code shows "This invite link isn't valid. Ask for a new one."
- [ ] **Step 3:** `Home`: my groups plus "Create group". `CreateGroup`: name → create → show `InviteQr` for `${origin}/j/${inviteCode}`. `Me`: profile, the **uid shown with a copy button** (for the seed), and a link to `/me/wrapped/<previous month>`.
- [ ] **Step 4:** `Today` (`/g/:groupId` index), per mockup 1: today's battle(s) as fixtures (home and away sides, `PhaseBadge`, photos once posted, tap → `/b/:id`), upcoming (players hidden until reveal: "Match revealed at 09:00"), then past results, newest first. A "Season N Wrapped" banner appears when `listSeasons` has a season with `endsOn < today` (links to `wrapped/:seasonId`). The admin sees "New battle" and an invite QR.
- [ ] **Step 5:** `NewBattle` (admin): two different member selects and three `datetime-local` inputs defaulting to today at the group's times, which must increase. Submit → `/b/:id`.
- [ ] **Step 6:** After rebasing on S1, run `npm run build`. Manual: create a group, join from a private window in one tap, create a battle, and it shows "Posting" in its window.
- [ ] **Step 7: Commit** `feat: onboarding, create/join group by link and QR, Today feed, custom battles`. Then the gate.

### S4 `feat/capture-post`: live camera and posting (~25 min)

**Owns:** `src/lib/image.ts`, `src/lib/camera.ts`, `src/lib/image.test.ts`, `src/data/posts.ts`, `src/components/Camera.tsx`, `src/components/PostPanel.tsx`. **Depends on:** S0; S1 for manual checks. **Design:** mockup **2 CAPTURE**.

**Interfaces:**
- Produces: `fitWithin(w: number, h: number, max = 1280): { width: number; height: number }` (keeps aspect ratio, never upscales); `cameraErrorMessage(err: unknown): string`; `captureFrame(video: HTMLVideoElement, max?: number): Promise<Blob>` (canvas → JPEG 0.8); `submitPost(battleId: string, blob: Blob, type: 'photo' | 'video'): Promise<void>` (uploads `${uid}/${battleId}.jpg|webm`, then RPC `submit_post`, mapping `too_late`, `not_open` and duplicate to friendly copy).
- `Camera({ onCapture(blob: Blob): void })`: `getUserMedia({ video: { facingMode: 'user' }, audio: false })`, flip button, shutter, preview with "Retake" / "Post my fit". `<video playsInline muted autoPlay>`. Stops tracks on unmount.
- `PostPanel({ view, viewerId, onPosted })` (S0 signature): if the viewer is a player without a post and `battlePhase` is `posting` → "Post my fit" → `Camera` → `submitPost` → `onPosted()`. On upload failure, keep the blob and offer "Try again". Otherwise render "✓ Posted" or "Waiting for <name>" per side and a countdown to the deadline.

- [ ] **Step 1: Write failing tests** `image.test.ts`:
```ts
expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 });
expect(fitWithin(3024, 4032)).toEqual({ width: 960, height: 1280 });
expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
test('cameraErrorMessage maps DOMException names', () => {
  expect(cameraErrorMessage({ name: 'NotAllowedError' })).toBe('Camera blocked. Allow camera access in your browser settings to post your fit.');
  expect(cameraErrorMessage({ name: 'NotFoundError' })).toBe('No camera found on this device.');
  expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/another app/i);
  expect(cameraErrorMessage(new TypeError('mediaDevices undefined'))).toMatch(/https/i);
});
```
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Camera errors show the message and "Retry". No file-input fallback.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS. Manual (desktop webcam via `npm run dev` on localhost): capture, then the upload appears in Storage.
- [ ] **Step 5: Commit** `feat: live in-app camera capture and outfit posting`. Then the gate.
- [ ] **HUMAN post-merge:** capture on one iPhone (Safari) and one Android (Chrome) on the Vercel URL.

### S5 `feat/voting-results`: battle page, voting, share link, results reveal (~40 min)

**Owns:** `src/data/votes.ts`, `src/components/VersusSeam.tsx`, `VoteSplit.tsx`, `ResultsReveal.tsx`, `CommentList.tsx`, `ReportButton.tsx`, `src/pages/Battle.tsx`, `ShareVote.tsx`. **Depends on:** S0; S1 for manual checks. Renders S4's `PostPanel` by its S0 signature. **Design:** mockups **3 VOTE** and **4 RESULTS** (the versus seam: a 10° `clip-path` slant with a circular "vs"/score badge on it; home = `--home` left, away = `--away` right).

**Interfaces:**
- Produces (`votes.ts`): `castVote(battleId: string, side: Side, comment: string | null): Promise<void>` (throws `Error(code)`), `myVote(battleId: string): Promise<Side | null>`, `getShareBattle(code: string): Promise<{ view: BattleView; group: { name: string; commentsEnabled: boolean }; players: Member[]; comments: CommentView[] } | null>`, `revealNow(battleId: string): Promise<void>`, `listComments(battleIds: string[]): Promise<CommentView[]>`, `report(t: { battleId?: string; messageId?: string }, reason: string): Promise<void>`.
- `VersusSeam({ left, right, badge })`: the shared split layout (photo radius 24, tile radius 28). `VoteSplit({ view, players, block, commentsEnabled, mySide, onVote(side, comment) })`: tap a side (it lifts and gets a `--pitch` ring), optional comment (placeholder `TONE_RULE`), a pill "Vote for <name>". Afterwards it shows "You voted for <name>" and "N votes so far". Block messages: `battler` "You're in this battle, so you can't vote in it", `not_open` "Voting opens when both fits are in", `closed`, `not_allowed`, `already_voted`.
- `ResultsReveal({ view, players, result, comments })`: the **one orchestrated motion** from tokens.md. Vote bars fill from the seam outwards (900 ms ease-out), then the winner's side expands and "+3" stamps in. Shows split %, points per player (+3 / +1 / −1 in `--down`), "N people voted", and a forfeit line ("<name> didn't post in time"). Under `prefers-reduced-motion`, the final state shows instantly. `CommentList`: name, emoji, body and a `ReportButton` ("Report", calls `report(..., 'tone')` then shows "Reported").

- [ ] **Step 1:** Implement `votes.ts` and the components.
- [ ] **Step 2:** `Battle` (`/b/:battleId`, member view): load with `getBattle`, `listMembers` and `myVote`, and poll every 5 s. By phase: `upcoming` → reveal time. `posting` → `PostPanel`. `voting` → `VoteSplit` (`isMember: true`, `shareVotingAllowed: group.allowShareVoting`). `awaiting_results` → countdown to `resultsAt`. `results` → `ResultsReveal` + `CommentList`. The admin sees **"Reveal results now"** (with confirm) in posting, voting and awaiting_results. When share voting is on, the admin sees `InviteQr` for `${origin}/v/${shareCode}` labelled "Public vote link".
- [ ] **Step 3:** `ShareVote` (`/v/:shareCode`): silent `ensureSession()` (no onboarding), the group name, `VoteSplit` (`isMember: false`), an optional "Your name" field (`upsertProfile(name, '👀')` on vote if filled), and polling every 5 s. In `results` it shows `ResultsReveal`. A null result shows "This battle isn't open to public voting."
- [ ] **Step 4:** After rebasing on S1 (and S4 if merged), run `npm run build`. Manual: a member votes once (a second attempt shows the already-voted message), a battler is blocked, share voting works in a private window when on and is blocked when off, and Reveal now flips everyone within about 5 s.
- [ ] **Step 5: Commit** `feat: side-by-side voting, share-link voting, results reveal and reveal-now`. Then the gate.

### S6a `feat/scoring-table`: Outfit of the Week, league table, League page (~30 min)

**Owns:** `src/lib/ootw.ts`, `src/lib/table.ts`, their tests, `src/components/LeagueTable.tsx`, `src/pages/League.tsx`. **Depends on:** S0, S1 (`resolveAll`). **Design:** mockup **5 LEAGUE** (no card, plain rows with `--line` dividers, display font for the numbers).

**Interfaces (Produces, for S9):**
```ts
export interface OotwAward { profileId: string; battleId: string; weekStart: string; share: number; awardedAt: Date }
export function outfitOfTheWeekAwards(facts: BattleFacts[], results: BattleResult[], now: Date): OotwAward[];
export interface TableRow { profileId: string; name: string; emoji: string; played: number; won: number; drawn: number; lost: number;
  points: number; winPct: number; rank: number; movement: number; ootw: number }   // movement +n = up n places
export function buildTable(members: Member[], results: BattleResult[], awards: OotwAward[]): TableRow[]; // sorted, ranked, movement 0
export function leagueTable(members: Member[], facts: BattleFacts[], now: Date): TableRow[];
```
OotW: group `played` results with ≥ 3 votes by `mondayOf(resolvedAt)`. The highest outfit share in the week wins, and ties all win. `awardedAt = max(latest resolvedAt in the week, Sunday 00:00 of that week)`. Return only awards with `awardedAt <= now`. `leagueTable` compares against `buildTable` over the results and awards strictly before the latest instant to set `movement`. `members` must include people who've left (the caller passes them).

- [ ] **Step 1: Write failing tests:**
  - ootw (week 2026-11-16 to 22): `highest share wins` (9–1 vs 2–1 → the 9-vote outfit, share 0.9); `needs at least 3 votes` (1–0 vs 3–1 → the 3–1 winner); `forfeit wins never qualify`; `ties all get it` (3–1 and 6–2 → 2 awards); `not awarded before Sunday` (now Sat 21 20:00 → `[]`; now Sun 22 18:00 with the latest result Sun 18:00 → awarded, `awardedAt` = that time).
  - table: `sorts by points then win% then name` (Ana 6 pts 2/2, Ben 6 pts 2/3, Cal 6 pts 2/2 → Ana, Cal, Ben); `forfeit counts as played and lost` (−1); `void_both gives -1 but no played`; `winPct rounds and is 0 with no games` (2/3 → 67); `adds Outfit of the Week +2` (`ootw: 1`); `movement after latest results` (Ben overtakes Ana → Ben +1, Ana −1); `member with no battles shows at 0`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `ootw.ts` and `table.ts`.
- [ ] **Step 4:** `LeagueTable({ rows, highlightId })`: `#` with ▲ lime / ▼ `--down` / – and the number, avatar + name (⭐ when `ootw > 0`), P, W–D–L, Win %, **Pts**. The current user's row is highlighted. `League` (`/g/:groupId/table`): header "Season N · Day d of D", or "Event battles" when `currentSeason` is null, then `leagueTable(members, battles.map(toFacts), new Date())`.
- [ ] **Step 5:** Run `npm test && npm run build`. Expected: PASS. Manual: the table shows the slice battle's result.
- [ ] **Step 6: Commit** `feat: Outfit of the Week, FPL-style league table and League page`. Then the gate.

---

## Wave 2: 15:00–17:00 (merge order S6 → S8 → S7 → S9 → S10)

### S6 `feat/pwa-deploy`: installable PWA and mock notification (~20 min)

**Owns:** `vite.config.ts` (add the PWA plugin only), `index.html` (meta tags only), `public/icons/*`, `src/pages/MockNotify.tsx`. **Depends on:** S0. **Design:** tokens (ink and paper colours).

- [ ] **Step 1:** Add `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Fits', short_name: 'Fits', display: 'standalone', start_url: '/', theme_color: '#5B34F2', background_color: '#5B34F2', icons: [192, 512, maskable 512] }, workbox: { navigateFallback: '/index.html', runtimeCaching: [] } })`. Don't cache Supabase calls. `index.html`: `apple-mobile-web-app-capable`, `apple-touch-icon`. Icons come from the team's icon, or a placeholder "F" in Big Shoulders on `--ink` with a `--home`/`--away` seam.
- [ ] **Step 2:** `MockNotify` (`/demo/notify`): a static fake lock screen with 3 notifications ("Today's match: you vs Marcus. Post your fit by 12:00", "Voting is open", "Results are in: you climbed to 2nd ▲"). Not linked from the nav.
- [ ] **Step 3:** `npm run build`. Expected: `dist/manifest.webmanifest` exists and `npm test` passes.
- [ ] **Step 4: Commit** `feat: installable Fits PWA and mock notification screen`. Then the gate. **HUMAN post-merge:** M3 install check.

### S8 `feat/seed-data`: seed "The Fit Crew" (~30 min)

**Owns:** `scripts/seed.ts`, `seed/photos/.gitkeep`. **Depends on:** S0, S2 (merged in Wave 1).

**CLI:** `npm run seed -- --me <profileId> [--reset]`. It reads `.env.seed.local` via `process.loadEnvFile` and uses `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Deterministic `mulberry32(2026)`.
- `--reset` deletes groups named `'The Fit Crew'` (cascade) and auth users `seed*@fitleague.test` / `crowd*@fitleague.test`.
- 7 members via `auth.admin.createUser({ email: 'seedN@fitleague.test', email_confirm: true })` plus profiles (fixed names and emoji matching the photo owners). `--me` is the 8th member and the admin. 12 non-member crowd voters. `allow_share_voting: true`.
- Votes: each member has a hidden style weight, and a voter picks a side with probability proportional to weight. Voters are the other 6 members (p = 0.85 each) plus 0–8 crowd voters. About 40% leave a comment from a fixed pool of outfit-only lines.
- **Season 1:** starts `2026-10-01`, 28 days, 1/day, via `scheduleSeason`, all resolved. About 6% one-sided no-shows, and one member has ≥ 2 forfeits.
- **Season 2:** `2026-11-14` → `2026-12-11`. Battles before today are resolved. Today's battle has both posts and some votes, with results at 18:00. Future battles have no posts.
- Photos: upload `seed/photos/*.jpg` once to `outfits/seed/<file>` and assign them round-robin. Exit with a clear error if there are none. Insert directly into tables (the service role bypasses RLS). Print a summary (battles, votes, comments, invite link).
- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx tsc --noEmit -p tsconfig.node.json` (or the project's node tsconfig; include `scripts/`) and `npm test`. Expected: PASS.
- [ ] **Step 3: Commit** `feat: deterministic seed script for the demo group`. Then the gate. **HUMAN post-merge:** M3 seed run.

### S7 `feat/settings-scheduler`: group settings, start season, lifecycle (~35 min)

**Owns:** `src/data/seasons.ts`, `src/data/lifecycle.ts` (replaces the stub), `src/pages/Settings.tsx`, optional `supabase/migrations/0002_settings.sql`. **Depends on:** S0, S2. **Design:** mockup **7 SETTINGS** (the **Group** tab).

**Interfaces:**
- Produces (`seasons.ts`): `updateGroupSettings(groupId: string, patch: Partial<Pick<Group, 'revealTime' | 'postDeadlineTime' | 'resultsTime' | 'battlesPerDay' | 'allowShareVoting' | 'commentsEnabled'>>): Promise<void>`; `startSeason(group: Group, memberIds: string[], startDate: string): Promise<string>` (`scheduleSeason` with `battlesPerDay ?? defaultBattlesPerDay(n)`, `rng = mulberry32(Date.now() % 2**31)`, `endsOn` = the last date, RPC `create_season`); `updateBattleTimes(rows: { id: string; revealAt: Date; postDeadline: Date; resultsAt: Date }[]): Promise<void>`; `leaveGroup(groupId: string): Promise<void>`.
- `lifecycle.ts`: `onGroupLoad(group, members)`. If the latest season ended before today and no later season exists, `startSeason(group, activeMemberIds, today)`. Swallow `season_active` and unique violations.

- [ ] **Step 1 (part a, must-have):** `Settings`: the admin edits and others see read-only. Fields: the three times; battles/day (blank = "Auto (n)" from `defaultBattlesPerDay(activeCount)`); toggles "Allow voting via share link" and "Comments"; read-only "Scheduling: round-robin (14 or fewer) / random pairings (over 14)"; "Save settings". When the times or battles/day change mid-season, `redateRemaining` the battles with `revealAt > now`, then `updateBattleTimes`. **Start season** (date defaults to tomorrow, disabled while one is active). Also shows the member list, the invite QR, links to the latest season's Wrapped, and "My Wrapped".
- [ ] **Step 2 (part b, cut second):** implement `onGroupLoad`. Non-admins get "Leave group" with a confirm.
- [ ] **Step 3:** `npm test && npm run build`. Manual: changing the times re-dates the remaining battles with the same pairs. Starting a season for a 4-member group gives 6 battles over 6 days. Leaving voids future battles but points stay. A new member shows in the League at 0.
- [ ] **Step 4: Commit** `feat: group settings, start season, auto next season and leave group`. Then the gate. **HUMAN post-merge:** if `0002_settings.sql` exists, paste it into the SQL Editor.

### S9 `feat/wrapped`: Wrapped stats and story cards (~45 min)

**Owns:** `src/lib/wrapped.ts`, `src/lib/wrapped.test.ts`, `src/data/wrapped.ts`, `src/components/StoryCards.tsx`, `src/pages/GroupWrapped.tsx`, `PersonalWrapped.tsx`. **Depends on:** S0, S1, S6a (S8 for the realistic manual check). **Design:** mockup **6 WRAPPED** (9:16, display font for the hero stats).

**Interfaces:**
```ts
export interface WrappedInput { members: Member[]; facts: BattleFacts[]; comments: CommentView[]; now: Date }
export interface OutfitRef { profileId: string; battleId: string; mediaPath: string; votes: number; share: number }
export interface GroupWrapped { champion: TableRow | null; finalTable: TableRow[];
  rivalry: { a: string; b: string; votesA: number; votesB: number; battleId: string } | null;
  ghost: { profileId: string; forfeits: number } | null; topOutfit: OutfitRef | null;
  commentOfSeason: CommentView | null; totalVotes: number; battlesPlayed: number }
export function groupWrapped(i: WrappedInput): GroupWrapped;
export interface PersonalWrapped { month: string; record: { w: number; d: number; l: number; f: number; points: number };
  perGroup: { groupId: string; groupName: string; rank: number; of: number; w: number; d: number; l: number; f: number; points: number }[];
  bestOutfit: OutfitRef | null; bestComment: CommentView | null; votesReceived: number }
export function personalWrapped(profileId: string, month: string, groups: { id: string; name: string; input: WrappedInput }[]): PersonalWrapped;
// data/wrapped.ts
loadSeasonInput(groupId: string, seasonId: string): Promise<WrappedInput>;
loadMonthInputs(month: string): Promise<{ id: string; name: string; input: WrappedInput }[]>;  // all my groups
```
Rules: rivalry = among `played` battles with votes > 0, the smallest |a − b|, then the larger total, then the latest. Ghost = most `F`; null if 0; ties by name. topOutfit = the most votes, then the higher share, then the earliest. commentOfSeason = the earliest comment on topOutfit's battle with a matching `side`. Personal: only `monthKey(resolvedAt) === month`. Rank uses `buildTable` over that month's results and awards. bestOutfit and bestComment apply the same rules to the person's own outfits.

- [ ] **Step 1: Write failing tests** with a 4-member fixture (Ana, Ben, Cal, Dee; 6 battles including a Dee forfeit, a 5–4 and a 7–1): `champion is table top`, `rivalry is the 5-4 battle`, `ghost is Dee with 1`, `topOutfit is the 7-vote outfit`, `commentOfSeason is earliest comment on that side`, `totalVotes sums all votes`. Personal: `filters to the month`, `record aggregates two groups`, `perGroup rank`, `bestComment on own best outfit`, `nulls when nothing played`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `wrapped.ts`.
- [ ] **Step 4:** `StoryCards({ cards, onClose })`: full-screen centred 9:16 frame (`aspect-ratio: 9/16; height: 100dvh; max-width: 100vw`), segmented progress at the top, tap the right 2/3 for next and the left 1/3 for back, auto-advance after 6 s, × to close. Group deck: intro, total votes and battles, champion, final table top 5, rivalry, Ghost award (skip if null), most-voted outfit, comment of the season, outro with `TONE_RULE`. Personal deck (`/me/wrapped/:month`): intro ("Your October"), record, ranks per group, best outfit, best comment about you, outro. No colour card.
- [ ] **Step 5:** `npm test && npm run build`. Manual on seeded data: both decks tap through on a phone with no empty cards.
- [ ] **Step 6: Commit** `feat: group and personal Wrapped story cards`. Then the gate.

### S10 `feat/chat`: group chat (~15 min). Cut first if behind

**Owns:** `src/data/chat.ts`, `src/pages/Chat.tsx`. **Depends on:** S0 (the `messages` table is in 0001), S1, and S5 (`ReportButton`). **Design:** mockup **9 CHAT**.

**Interfaces:** `listMessages(groupId: string, limit = 100): Promise<{ id: string; author: Member; body: string; createdAt: Date }[]>`, `sendMessage(groupId: string, body: string): Promise<void>` (body through `cleanText`, 1–500 characters).
- [ ] **Step 1:** `Chat`: message list (poll every 5 s, auto-scroll to the bottom), `ReportButton` per message (`messageId`), input with the `TONE_RULE` placeholder, "Send".
- [ ] **Step 2:** `npm run build`. Manual: two browsers exchange messages, and a blocklisted word arrives masked.
- [ ] **Step 3: Commit** `feat: group chat with word filter and report`. Then the gate.

---

## Stretch (only if a wave finishes early, and never after 17:00)

- **S11 `feat/video` (owns changes to `Camera.tsx`, `PostPanel.tsx`, `VersusSeam.tsx`):** Photo/Video toggle using `MediaRecorder` (`video/webm`, or `video/mp4` where `isTypeSupported` says so), auto-stop at **10 s**, `submitPost(..., 'video')`. Render with `<video playsInline muted loop autoPlay>`. HUMAN: test on iPhone and Android.
- **S12 `feat/random-pairings` (owns changes to `scheduler.ts` and its test, and `seasons.ts`):** `randomPairings(a: { memberIds: string[]; gamesPlayed: Record<string, number>; recentOpponents: Record<string, string[]>; count: number; rng: () => number }): [string, string][]`. Tests: `prefers fewest games`, `avoids recent rematch when possible`, `no one twice`, `returns count pairs`. For groups over 14, `onGroupLoad` creates the next day's pairings.
