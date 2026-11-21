# Fits — Design

*App name: **Fits**.*
Date: 2026-11-21 · Event: KCL Tech First Year Hack · Track: **Creative Tech ("Code Meets Culture")**
Team: Michael Wu, Marcus Wong, Jae den Lim

## 1. Intent

A season-long outfit league for friend groups, modelled on how Fantasy Premier League mini-leagues feel: a points table, rank movement and bragging rights. Each day, pairs from the group are drawn to "1v1" with their outfits. Everyone else votes for the better fit, and points go into the group's league table. Wrapped recaps celebrate each season and each person's month.

**Why:** fashion is named in the track brief ("remix music, art, film, fashion or stories"), and judges look for creativity, connection to culture and cool experiences. Friend-group fit checks are a real part of student culture. The league gives people a reason to come back every day.

**Success on the day:** a deployed web app that real people vote on during the hackathon, and a **live demo at judging (18:10)** where the judges vote in a real battle from their own phones, then see the league table and Wrapped. Submission (project name, repo, demo) goes on the MLH page; hard deadline 18:00, draft by 17:30. A short backup video is recorded in case the live demo fails or the submission form asks for one.

## 2. Goals, non-goals, anti-goals

**Goals**
- Real, deployed web app at a public link. Real people vote in a real battle during the hackathon.
- The same build is installable as a phone app (PWA), and the video shows this "app version".
- The league feels like FPL: a table, points, win %, W–D–L and rank arrows.
- Settings for each group, with sensible defaults.
- Seasonal group Wrapped and monthly personal Wrapped, as vertical story cards.

**Non-goals (today)**
- Battle Mode (live instant 1v1s, challenges, spin-the-wheel). Future scope, built only if there's spare time.
- Weather-and-wardrobe AI outfit suggester. Mentioned as "next steps" in the video only.
- AI commentator. Future scope.
- Real push notifications. Shown as a mock screen in the video.
- A native app or app store build.
- A separate "society mode". Large groups use the same app with scaled settings.

**Anti-goals (failure even if it technically works)**
- The app becomes a vehicle for judging people's bodies or looks. **Tone rule: roast the outfit, never the person.** The video states this in one line. A basic word filter on comments plus a report button is enough today.
- A broken or empty-looking demo. The seeded history must make the league look lived-in.
- Spending the day on backend plumbing that never appears in the video.

## 3. Constraints

- Must be built with **JetBrains Air** (an AI coding-agent tool in IntelliJ IDEA). Required by the event rules.
- All project work happens today. About 6 hours of build time (11:00–18:00, minus the workshop and lunch).
- Judging is a **live demo** at a table, a few minutes per team, on venue Wi-Fi (eduroam). It can't be retaken, so it must be reliable: deployed early, tested on several phones, with a phone hotspot as backup.
- Live capture only: photos and videos must come from the device camera in the app. No gallery uploads.

## 4. Approaches considered

1. **React (Vite) + Supabase + Vercel, installable as a PWA — CHOSEN.** Supabase provides the database, auth, photo/video storage and realtime updates. Vercel hosts the site for free. The PWA manifest makes "Add to Home Screen" give an app icon and a full-screen window. One build serves both the web version and the app version. There's almost no server code, so time goes into the league, Wrapped and polish.
2. **React + own Node/Express + SQLite on Render.** Full control, but photo storage, hosting and sync would cost hours that never appear in the video. Rejected.
3. **Kotlin Multiplatform native app.** Slow first setup, iOS needs a Mac, and friends can't join just by opening a link. Rejected.
4. **Front-end only with simulated users.** Simplest option, but no real people could vote. Rejected because real votes are a goal.

## 5. Decided rules

### Groups and joining
- Private groups. Join by **QR code or invite link**.
- Joining should be one tap: name and emoji (or the lightest Supabase auth that gets there; builder's choice, see §9).
- Groups can be any size, from friend groups up to uni societies. Same features; only the scheduling scales (see below).

### Scheduling (who battles whom)
- **Groups of up to 14 people: round-robin season.** Everyone faces everyone exactly once, in a shuffled, hidden order. Pairs are revealed on the day.
  - Default group: **8 people → 28 battles → 1 battle a day → about a 28-day (monthly) season.**
- **Groups over 14: random pairings** that keep everyone's game count roughly equal (prefer people with the fewest games played, avoid recent rematches).
- **Battles per day scale with group size and can be changed in settings.** Larger groups target around **2–4 battles a day**. *Builder's call (proposed):* for round-robin groups, default battles per day = ceil(total battles ÷ 28), which gives 8 people → 1/day, 10 → 2, 12 → 3, 14 → 4. For groups over 14, default to 2–4 a day scaling with size (for example 15–25 people → 2, 26–40 → 3, 41+ → 4).
- Someone can't be in two battles on the same day.

### Season lifecycle *(designer's calls, confirm or change)*
- **The admin presses "Start season".** The whole schedule is generated then and **stored as fixed battles with dates** (not recalculated each day).
- **Joining mid-season:** in a round-robin group (14 or fewer), new members join the table at 0 and play from **next season**. In a group over 14, they enter the next day's random pairings.
- **Leaving mid-season:** their remaining battles are void. Points already scored stay.
- **Changing battles per day or the times mid-season:** only re-dates the remaining battles; pairings stay the same.
- **Crossing the 14-person line mid-season:** the switch to random pairings happens next season.
- **When a season ends:** group Wrapped unlocks and the next season starts automatically the next day with all current members. The admin can change settings in between.
- **Hackathon group:** the admin can also create a single **custom battle** (pick two people, set times), which covers the event battle and the judging battle without a full season.

### Daily timeline (defaults, all changeable per group)
| Time | What happens |
|---|---|
| 09:00 | Matches revealed |
| by 12:00 | Both battlers must post their outfit |
| 12:00 – 17:59 | Voting open (opens as soon as both have posted, closes just before results) |
| 18:00 | Results revealed, points added to the table |

### Posting
- **Live capture only, using the in-app camera** (photo or short video). No uploads from the gallery.
- Photo is the must-have. **Video clips (max 10 s) are a stretch goal.**

### Voting
- The two outfits are shown **side by side**. The voter taps the outfit or person they prefer.
- Optional comment box with each vote.
- One vote per person per battle. **The two battlers can't vote in their own battle.**
- Votes are anonymous. Comments show the commenter's name (builder's call; can be changed).

### Scoring
| Result | Points |
|---|---|
| Win | 3 |
| Draw (equal votes) | 1 |
| Loss | 0 |
| **Forfeit** (didn't post by the deadline) | **−1** |
| **Outfit of the Week** | **+2** |

- If only one person posts, they win (3 points) and the no-show gets −1.
- If neither posts, both get −1 and the battle is void.
- **Outfit of the Week:** the outfit with the highest **vote share** (% of votes in its battle) that week gets +2. If there's a tie, every tied outfit gets it. A battle with zero votes is a draw.
  - *Designer's calls:* a battle needs **at least 3 votes** to qualify, so a 1–0 win can't beat a 9–1 win. Wins by forfeit don't qualify. A week runs Monday to Sunday, and the +2 is awarded at Sunday's results time.

### League table (FPL-style)
Columns: **rank (with up/down arrow since the last results), name, played, W–D–L, win %, points.**
Sorting: points, then win %, then name.

### Wrapped
- **Group Wrapped:** at the end of each season. Suggested cards: season champion, final table, biggest rivalry (closest head-to-head), most forfeits ("Ghost award"), most-voted outfit, comment of the season, total votes cast.
- **Personal Wrapped:** **monthly (calendar month), fixed (not a setting).** Covers the person across all their groups, with a per-group breakdown. Suggested cards: record, final rank(s), best outfit, most-voted colour (or skip if colour detection isn't feasible), best comment about you.
- *Designer's call:* **there are no comment likes.** "Comment of the season" and "best comment about you" are the comments left on the most-voted outfit (season-wide or yours). Likes can be added later.
- *Designer's call, demo data:* the seeded group has **one full finished season** (28 days, last calendar month), so group and personal Wrapped are both real. On top of that is **about a week of the current season**, so the table and rank arrows are live.
- Format: **vertical 9:16 story cards** that you tap through, like Spotify Wrapped.

### Group chat
- Each group has a simple chat area. Text only today. Subject to the same tone rule and word filter.

### Group settings (editable by the group's admin = creator)
| Setting | Default |
|---|---|
| Season length / scheduling | Auto from group size (see above) |
| Battles per day | Auto from group size (see above) |
| Match reveal time | 09:00 |
| Posting deadline | 12:00 |
| Results time | 18:00 (voting closes just before) |
| Allow voting via share link | **Off** |
| Comments | On |

Not a setting: personal Wrapped frequency (always monthly).

### Public voting via share link
- With **"Allow voting via share link"** on, each battle has a public link. Anyone with it can view the two outfits and vote **without joining the group**. Limit to one vote per device or browser (a simple anti-spam measure; doesn't need to be perfect).

## 6. Hackathon plan ("the actual version")

- Create a real group for the event with **custom times**, for example reveal 13:00, post by 14:00, results 16:30. Exact times are the team's call on the day.
- **Two people submit outfits.** Turn on the share link and give it out (event Discord, people in the room). Other people joining and submitting is a bonus, not the main goal.
- A separate **seeded friend group** (8 people, one finished season plus about a week of the current one, with consent from anyone whose photo is used) powers the full table, rank arrows and Wrapped in the demo.
- The working version needs to be deployed in time to collect votes before the results time. Target about 14:00.
- **Judging battle:** a second battle whose voting is still open at judging time, so the judges can vote live. To trigger the results reveal on cue, the group admin gets a **"Reveal results now"** button that closes voting early. It's a small addition to the settings that keeps the reveal under the presenter's control; keep it as a normal admin feature, not a hidden hack.

## 7. Live demo plan (about 3 minutes at the judging table)

1. **Hook (10 s):** "1v1 your friends in a fashion battle. Every day. All season." Two team members are today's battlers.
2. **Judges scan the QR code** for the judging battle, see the two outfits side by side, vote and leave a comment. This happens in the first 30 seconds, so the judges are taking part, not watching.
3. While they vote, show the **installed app version** on a phone: the match reveal, live photo capture and the group feed.
4. **Results reveal:** the presenter taps "Reveal results now", the winner is shown with the judges' comments, and the table updates with rank arrows.
5. **The real hackathon league:** "X people voted on today's battle" (real numbers from the afternoon).
6. **Group settings:** change the times and battles per day, mentioning big groups and societies.
7. **Wrapped:** tap through group cards, then personal cards, on the seeded group.
8. **Close:** mock notification screen for the daily loop, one line on the tone rule, and next steps (weather-and-wardrobe AI, Battle Mode, real notifications).

**Reliability:** deployed and tested on 3 or more phones by 16:00. Bring a phone hotspot. Rehearse the full run at least twice. Keep the seeded group and Wrapped loaded in a second tab or device. Record a short backup video of the full flow by about 17:00, in case the live demo fails or the submission asks for one.

## 8. Priorities (cut from the bottom if time runs out)

1. **Must-have:** join by link or QR, live photo capture, side-by-side voting with comments, scoring and results, league table, editable group settings, public share-link voting, deployed and installable as a PWA, name and visual identity.
2. **Next:** Wrapped (group and personal) on seeded data.
3. **Then:** simple group chat.
4. **Stretch:** video clips (max 10 s), scheduling for groups over 14 (can be explained in the video instead), Battle Mode.

Polish focus: the results reveal, one-tap joining, Wrapped story cards, seeded group, name and visual identity.

## 9. Team workflow

- **AI coding agents write most of the code, in parallel**, run through JetBrains Air, which the event rules require. Each workstream is on its own git branch. A higher-tier model (Opus) reviews each branch before it's merged to main.
- **A team member also reviews the code.** Tasks should be small, reviewable commits.
- The remaining team members handle seed photos (with consent), the name and visual identity, the hackathon voting push (Discord, the room) and demo rehearsal.

## 10. Left to the builder

- Data model and Supabase table design. Keep it real-backend-ready; nothing is simulated except the seeded history.
- How scheduled events (reveal, deadline, results) fire: scheduled function, cron, or computing state from timestamps when the page loads. Computing from timestamps is fine.
- Auth method, as long as joining stays close to one tap.
- Styling library, component structure, how photos are compressed.
- How the word filter works (a simple blocklist is fine).
- How the seeded data is generated.
