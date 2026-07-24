const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000

export function jakartaTodayRange(reference: Date = new Date()) {
  const jakartaMs = reference.getTime() + JAKARTA_OFFSET_MS
  const j = new Date(jakartaMs)
  const y = j.getUTCFullYear()
  const m = j.getUTCMonth()
  const d = j.getUTCDate()
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - JAKARTA_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export function jakartaNowIso(reference: Date = new Date()) {
  const j = new Date(reference.getTime() + JAKARTA_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())}T${pad(j.getUTCHours())}:${pad(j.getUTCMinutes())}:${pad(j.getUTCSeconds())}+07:00`
}

export function formatJakartaTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function isoOf(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

export function jakartaCurrentWeek(reference: Date = new Date()) {
  const j = new Date(reference.getTime() + JAKARTA_OFFSET_MS)
  const y = j.getUTCFullYear()
  const m = j.getUTCMonth()
  const d = j.getUTCDate()
  const anchorNoon = new Date(Date.UTC(y, m, d, 12))
  const jsWeekday = anchorNoon.getUTCDay() // 0 = Sun .. 6 = Sat
  const mondayOffset = jsWeekday === 0 ? -6 : 1 - jsWeekday

  const labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
  const todayIso = jakartaTodayDateIso()

  return labels.map((label, i) => {
    const dayDate = new Date(anchorNoon.getTime() + (mondayOffset + i) * 24 * 60 * 60 * 1000)
    const date = dayDate.getUTCDate()
    const month = dayDate.getUTCMonth()
    const year = dayDate.getUTCFullYear()
    const iso = isoOf(year, month, date)
    return {
      label,
      date,
      month,
      year,
      iso,
      isToday: iso === todayIso,
    }
  })
}

export function jakartaTodayDateIso(reference: Date = new Date()) {
  const j = new Date(reference.getTime() + JAKARTA_OFFSET_MS)
  return isoOf(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate())
}

/** Parses a "YYYY-MM-DD" string into a Date instant at Jakarta noon, safe for jakartaTodayRange(). */
export function parseJakartaDateIso(dateIso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) return new Date()
  const [, y, m, d] = match
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12) - JAKARTA_OFFSET_MS)
}

export function shiftJakartaDateIso(dateIso: string, deltaDays: number) {
  const reference = parseJakartaDateIso(dateIso)
  const shifted = new Date(reference.getTime() + deltaDays * 24 * 60 * 60 * 1000)
  return jakartaTodayDateIso(shifted)
}

export function formatJakartaDateLabel(dateIso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(parseJakartaDateIso(dateIso))
}
