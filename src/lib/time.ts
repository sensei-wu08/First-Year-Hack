// All helpers use local `Date` constructors only, so wall-clock times survive DST changes.

const pad = (n: number): string => String(n).padStart(2, '0')

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m - 1, d]
}

/** 'YYYY-MM-DD' + 'HH:mm' -> the local Date at that wall-clock time. */
export function atLocalTime(date: string, hhmm: string): Date {
  const [y, m, d] = parseDate(date)
  const [hh, mm] = hhmm.split(':').map(Number)
  return new Date(y, m, d, hh, mm, 0, 0)
}

/** Local calendar date of `d` as 'YYYY-MM-DD'. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Add `n` calendar days (may be negative) to a 'YYYY-MM-DD' date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = parseDate(date)
  return localDateKey(new Date(y, m, d + n))
}

/** The Monday (as 'YYYY-MM-DD') of the Monday-Sunday week containing `d`. */
export function mondayOf(d: Date): string {
  const offset = (d.getDay() + 6) % 7
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset))
}

/** Calendar month of `d` as 'YYYY-MM'. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 'YYYY-MM-DD' as a short day and month, e.g. '12 Dec'. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
