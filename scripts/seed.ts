/**
 * Seeds "The Fit Crew": 8 members (7 fake + the presenter), one finished season, a week of the
 * current one, votes and comments. Deterministic (mulberry32(2026)) apart from row ids.
 *
 *   npm run seed -- --me <profileId> [--reset]
 *
 * Run it from the checkout that holds `.env.seed.local` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Optional: APP_URL (e.g. https://fits.vercel.app) so the printed invite link is complete.
 */
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { cleanText } from '../src/lib/filter.ts'
import { mulberry32, shuffle } from '../src/lib/rng.ts'
import { scheduleSeason, defaultBattlesPerDay } from '../src/lib/scheduler.ts'
import type { DayTimes, ScheduledBattle } from '../src/lib/scheduler.ts'
import { addDays, localDateKey } from '../src/lib/time.ts'

// Battle times are device-local (Europe/London). Set before any Date is created.
process.env.TZ = 'Europe/London'

const GROUP_NAME = 'The Fit Crew'
const SEED = 2026
const TIMES: DayTimes = { reveal: '09:00', postDeadline: '12:00', results: '18:00' }
const SEASON_DAYS = 28
const SEASON1_START = '2026-10-01'
const SEASON2_START = '2026-11-14'
const NO_SHOW_RATE = 0.06
const MEMBER_VOTE_RATE = 0.85
const COMMENT_RATE = 0.4
const CROWD_SIZE = 12
const SEED_EMAIL = /^(seed|crowd)\d+@fitleague\.test$/

/** Fixed fake members (edit names/emoji to match whoever's photos are in seed/photos). `style` is the hidden weight. */
const MEMBERS = [
  { name: 'Marcus', emoji: '🧢', style: 1.0 },
  { name: 'Priya', emoji: '🕶️', style: 1.6 },
  { name: 'Jae', emoji: '🧥', style: 1.1 },
  { name: 'Amara', emoji: '👟', style: 1.4 },
  { name: 'Tom', emoji: '🎩', style: 0.6 }, // the flaky one: guaranteed >= 2 forfeits in season 1
  { name: 'Sofia', emoji: '🌸', style: 1.2 },
  { name: 'Dev', emoji: '🧣', style: 0.7 },
]
const FLAKY_INDEX = 4
const ME_STYLE = 1.15

/** Outfit-only lines (tone rule: roast the outfit, never the person). */
const COMMENTS = [
  'The jacket carries this whole look.',
  'Colours work really well together.',
  'Those trainers are a bold choice and it pays off.',
  'Love the layering here.',
  'The proportions are spot on.',
  'That jumper has to go back in the wardrobe, sorry.',
  'Clean, simple, and the fit is perfect.',
  'Too many patterns fighting each other.',
  'The belt really ties the outfit together.',
  'Great texture mix with the knit and the denim.',
  'A bit safe, but the shoes save it.',
  'Hat and scarf combo is unreal.',
  'The trousers are doing a lot of heavy lifting.',
  'This palette is so good for autumn.',
  'Not sure about the socks, the rest is great.',
  'Statement coat, no notes.',
  'Matching set looks sharp.',
  'The accessories make the outfit.',
]

const photosDir = fileURLToPath(new URL('../seed/photos/', import.meta.url))

const makeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
type Db = ReturnType<typeof makeClient>

function fail(msg: string): never {
  console.error(`\nSeed failed: ${msg}\n`)
  process.exit(1)
}

function parseArgs(argv: string[]): { me: string; reset: boolean } {
  let me = ''
  let reset = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--reset') reset = true
    else if (a === '--me') me = argv[++i] ?? ''
    else if (a.startsWith('--me=')) me = a.slice(5)
    else fail(`unknown argument "${a}". Usage: npm run seed -- --me <profileId> [--reset]`)
  }
  if (!/^[0-9a-f-]{36}$/i.test(me)) {
    fail('pass your profile id: npm run seed -- --me <profileId> [--reset]\n(the uuid of your row in profiles, see the Supabase table editor)')
  }
  return { me: me.toLowerCase(), reset }
}

function loadEnv(): { url: string; key: string } {
  try {
    process.loadEnvFile('.env.seed.local')
  } catch {
    fail(
      `could not load .env.seed.local from ${process.cwd()}.\nRun the seed from the checkout that has that file (it needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).`,
    )
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('.env.seed.local must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  return { url, key }
}

function listPhotos(): string[] {
  let files: string[] = []
  try {
    files = readdirSync(photosDir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .sort()
  } catch {
    // directory missing: handled below
  }
  if (files.length === 0) {
    fail(`no photos found. Put some .jpg outfit photos (with consent) in ${photosDir} and run again.`)
  }
  return files
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) fail(`${what}: ${res.error.message}`)
  return res.data
}

function mustHave<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  const data = must(res, what)
  if (data === null) fail(`${what}: no data returned`)
  return data
}

async function insertChunks(supabase: Db, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 400))
    if (error) fail(`insert into ${table}: ${error.message}`)
  }
}

async function listSeedUsers(supabase: Db): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) fail(`listing auth users: ${error.message}`)
    for (const u of data.users) if (u.email && SEED_EMAIL.test(u.email)) out.push({ id: u.id, email: u.email })
    if (data.users.length < 1000) return out
  }
}

async function createUser(supabase: Db, email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data.user) fail(`creating ${email}: ${error?.message ?? 'no user returned'}`)
  return data.user.id
}

interface Plan {
  id: string
  season: 1 | 2
  seasonId: string
  sb: ScheduledBattle
  state: 'resolved' | 'today' | 'future'
  noShow: 'a' | 'b' | null
}

async function main() {
  const { me, reset } = parseArgs(process.argv.slice(2))
  const files = listPhotos()
  const { url, key } = loadEnv()
  const supabase = makeClient(url, key)

  for (const c of COMMENTS) {
    if (cleanText(c).flagged) fail(`comment pool line trips the word filter: "${c}"`)
  }

  // --- reset / pre-flight -------------------------------------------------
  if (reset) {
    const del = await supabase.from('groups').delete().eq('name', GROUP_NAME).select('id')
    console.log(`Reset: deleted ${mustHave(del, 'deleting old groups').length} "${GROUP_NAME}" group(s) (cascade).`)
    const users = await listSeedUsers(supabase)
    for (const u of users) {
      const { error } = await supabase.auth.admin.deleteUser(u.id)
      if (error) fail(`deleting ${u.email}: ${error.message}`)
    }
    console.log(`Reset: deleted ${users.length} seed/crowd auth user(s).`)
  } else {
    const existing = mustHave(await supabase.from('groups').select('id').eq('name', GROUP_NAME), 'checking for an existing group')
    if (existing.length > 0 || (await listSeedUsers(supabase)).length > 0) {
      fail(`"${GROUP_NAME}" (or its seed users) already exists. Run again with --reset to replace it.`)
    }
  }

  const meRow = must(await supabase.from('profiles').select('id, name').eq('id', me).maybeSingle(), 'looking up --me profile')
  if (!meRow) fail(`no profile with id ${me}. Open the app on your phone, finish onboarding, then copy your profile id.`)

  // --- photos -------------------------------------------------------------
  for (const f of files) {
    const { error } = await supabase.storage
      .from('outfits')
      .upload(`seed/${f}`, readFileSync(`${photosDir}${f}`), { contentType: 'image/jpeg', upsert: true })
    if (error) fail(`uploading ${f} to outfits/seed/ (is the "outfits" bucket created by the SQL?): ${error.message}`)
  }
  console.log(`Uploaded ${files.length} photo(s) to outfits/seed/.`)

  // --- people -------------------------------------------------------------
  const ids: string[] = []
  for (let i = 0; i < MEMBERS.length; i++) ids.push(await createUser(supabase, `seed${i + 1}@fitleague.test`))
  const crowd: string[] = []
  for (let i = 0; i < CROWD_SIZE; i++) crowd.push(await createUser(supabase, `crowd${i + 1}@fitleague.test`))

  await insertChunks(
    supabase,
    'profiles',
    MEMBERS.map((m, i) => ({ id: ids[i], name: m.name, emoji: m.emoji })),
  )
  const memberIds = [...ids, me]
  const nameOf = new Map<string, string>(MEMBERS.map((m, i) => [ids[i], m.name]))
  nameOf.set(me, String(meRow.name))
  const style = new Map<string, number>(MEMBERS.map((m, i) => [ids[i], m.style]))
  style.set(me, ME_STYLE)
  const flaky = ids[FLAKY_INDEX]

  // --- group, memberships, seasons ----------------------------------------
  const joined = new Date(2026, 8, 30, 12, 0, 0).toISOString()
  const group = mustHave<{ id: string; invite_code: string }>(
    await supabase
      .from('groups')
      .insert({
        name: GROUP_NAME,
        admin_id: me,
        reveal_time: TIMES.reveal,
        post_deadline_time: TIMES.postDeadline,
        results_time: TIMES.results,
        battles_per_day: null,
        allow_share_voting: true,
        comments_enabled: true,
      })
      .select('id, invite_code')
      .single(),
    'creating the group',
  )
  const groupId = String(group.id)
  await insertChunks(
    supabase,
    'memberships',
    memberIds.map((profile_id) => ({ group_id: groupId, profile_id, joined_at: joined })),
  )

  const season1End = addDays(SEASON1_START, SEASON_DAYS - 1)
  const season2End = addDays(SEASON2_START, SEASON_DAYS - 1)
  const seasonRows = mustHave(
    await supabase
      .from('seasons')
      .insert([
        { group_id: groupId, number: 1, starts_on: SEASON1_START, ends_on: season1End },
        { group_id: groupId, number: 2, starts_on: SEASON2_START, ends_on: season2End },
      ])
      .select('id, number'),
    'creating seasons',
  )
  const seasonId = (n: number) => String(seasonRows.find((s) => s.number === n)?.id)

  // --- schedule -----------------------------------------------------------
  const rng = mulberry32(SEED)
  const perDay = defaultBattlesPerDay(memberIds.length)
  const sched1 = scheduleSeason({ memberIds, startDate: SEASON1_START, battlesPerDay: perDay, times: TIMES, rng })
  const sched2 = scheduleSeason({ memberIds, startDate: SEASON2_START, battlesPerDay: perDay, times: TIMES, rng })
  const now = new Date()
  const today = localDateKey(now)

  const plans: Plan[] = [
    ...sched1.map((sb): Plan => ({ id: randomUUID(), season: 1, seasonId: seasonId(1), sb, state: 'resolved', noShow: null })),
    ...sched2.map(
      (sb): Plan => ({
        id: randomUUID(),
        season: 2,
        seasonId: seasonId(2),
        sb,
        state: sb.date < today ? 'resolved' : sb.date === today ? 'today' : 'future',
        noShow: null,
      }),
    ),
  ]

  // Season 1 no-shows: ~6% of battles in total, one-sided, never the presenter. The flaky member
  // gets exactly 2 of them (their 2nd and 5th battles); any remaining budget is spread at random.
  const s1 = plans.filter((p) => p.season === 1)
  const target = Math.max(2, Math.round(NO_SHOW_RATE * s1.length))
  const flakyBattles = s1.filter((p) => p.sb.playerA === flaky || p.sb.playerB === flaky)
  for (const p of [flakyBattles[1], flakyBattles[4]]) {
    if (p) p.noShow = p.sb.playerA === flaky ? 'a' : 'b'
  }
  const noShowRng = mulberry32(SEED * 7919)
  for (const p of shuffle(s1, noShowRng)) {
    if (s1.filter((x) => x.noShow !== null).length >= target) break
    if (p.noShow !== null) continue
    const side = p.sb.playerA === me ? 'b' : p.sb.playerB === me ? 'a' : noShowRng() < 0.5 ? 'a' : 'b'
    const skipper = side === 'a' ? p.sb.playerA : p.sb.playerB
    if (skipper === me) continue
    p.noShow = side
  }

  // --- posts and votes ----------------------------------------------------
  const postRows: Record<string, unknown>[] = []
  const voteRows: Record<string, unknown>[] = []
  let photoCursor = 0
  let comments = 0
  const stats = { s1: { battles: 0, votes: 0, forfeits: 0 }, s2: { battles: 0, votes: 0, forfeits: 0 } }

  plans.forEach((p, k) => {
    const sb = p.sb
    const st = p.season === 1 ? stats.s1 : stats.s2
    st.battles++
    if (p.noShow) st.forfeits++
    if (p.state === 'future') return
    const r = mulberry32(SEED * 104729 + k)
    const t0 = sb.revealAt.getTime()
    const window = sb.postDeadline.getTime() - t0
    const postTimes: number[] = []
    const posters = [p.noShow === 'a' ? null : sb.playerA, p.noShow === 'b' ? null : sb.playerB]
    for (const profileId of posters) {
      if (!profileId) continue
      let t = t0 + (0.05 + 0.85 * r()) * window
      if (p.state === 'today') t = Math.min(t, now.getTime() - 60_000)
      postTimes.push(t)
      postRows.push({
        battle_id: p.id,
        profile_id: profileId,
        media_path: `seed/${files[photoCursor++ % files.length]}`,
        media_type: 'photo',
        created_at: new Date(t).toISOString(),
      })
    }
    if (postTimes.length < 2) return // forfeit: nobody can vote

    const wA = style.get(sb.playerA) ?? 1
    const wB = style.get(sb.playerB) ?? 1
    const pickA = wA / (wA + wB)
    const lo = Math.max(...postTimes)
    const hi = Math.max(
      lo + 60_000,
      p.state === 'today' ? Math.min(sb.resultsAt.getTime(), now.getTime()) : sb.resultsAt.getTime() - 60_000,
    )
    const memberRate = p.state === 'today' ? 0.5 : MEMBER_VOTE_RATE
    const crowdCount = p.state === 'today' ? Math.floor(r() * 5) : Math.floor(r() * 9)

    const voters: string[] = []
    // The presenter keeps today's battle unvoted, so they can vote live in the demo (it closes at 18:45).
    for (const m of memberIds) {
      if (m === sb.playerA || m === sb.playerB) continue
      if (p.state === 'today' && m === me) continue
      if (r() < memberRate) voters.push(m)
    }
    const crowdPool = crowd.slice()
    for (let i = 0; i < crowdCount; i++) voters.push(crowdPool.splice(Math.floor(r() * crowdPool.length), 1)[0])
    if (p.state === 'today' && voters.length < 2) voters.push(...crowdPool.slice(0, 2 - voters.length))

    for (const voter of voters) {
      const comment = r() < COMMENT_RATE ? COMMENTS[Math.floor(r() * COMMENTS.length)] : null
      if (comment) comments++
      st.votes++
      voteRows.push({
        battle_id: p.id,
        voter_id: voter,
        side: r() < pickA ? 'a' : 'b',
        comment,
        created_at: new Date(lo + r() * (hi - lo)).toISOString(),
      })
    }
  })

  // Today's battle stays open until 18:45 local (reveal and deadline unchanged), so it is still live at the 18:10 demo.
  const todayResultsAt = new Date(now)
  todayResultsAt.setHours(18, 45, 0, 0)
  await insertChunks(
    supabase,
    'battles',
    plans.map((p) => ({
      id: p.id,
      group_id: groupId,
      season_id: p.seasonId,
      player_a: p.sb.playerA,
      player_b: p.sb.playerB,
      reveal_at: p.sb.revealAt.toISOString(),
      post_deadline: p.sb.postDeadline.toISOString(),
      results_at: (p.state === 'today' ? todayResultsAt : p.sb.resultsAt).toISOString(),
    })),
  )
  await insertChunks(supabase, 'posts', postRows)
  await insertChunks(supabase, 'votes', voteRows)

  // --- summary ------------------------------------------------------------
  const base = (process.env.APP_URL ?? '').replace(/\/$/, '')
  const todays = plans.filter((p) => p.state === 'today')
  console.log('\nSeeded "The Fit Crew"')
  console.log(`  members:  ${memberIds.length} (${memberIds.map((m) => nameOf.get(m)).join(', ')}); admin = you`)
  console.log(`  crowd:    ${CROWD_SIZE} non-member voters`)
  console.log(`  season 1: ${SEASON1_START} to ${season1End}, ${stats.s1.battles} battles, ${stats.s1.votes} votes, ${stats.s1.forfeits} no-shows`)
  console.log(`  season 2: ${SEASON2_START} to ${season2End}, ${stats.s2.battles} battles (today = ${today}), ${stats.s2.votes} votes`)
  console.log(`  posts:    ${postRows.length}`)
  console.log(`  votes:    ${voteRows.length} (${comments} with comments)`)
  console.log(
    todays.length
      ? `  today:    ${todays.map((p) => `${nameOf.get(p.sb.playerA)} vs ${nameOf.get(p.sb.playerB)}${p.sb.playerA === me || p.sb.playerB === me ? ' (you!)' : ''}`).join('; ')}, results 18:45`
      : '  today:    no battle scheduled today',
  )
  console.log(`  invite:   ${base ? `${base}/j/${group.invite_code}` : `<your app url>/j/${group.invite_code}`}  (code ${group.invite_code})`)
  if (!base) console.log('            (set APP_URL=https://your-app.vercel.app in the environment to print the full link)')
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
