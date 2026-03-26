import {
  startOfMonth,
  addMonths,
  subMonths,
  addDays,
  format,
  differenceInDays,
  getDaysInMonth,
  isSameMonth,
  getDate,
} from "date-fns"

export type BillingPeriod = {
  from: string
  to: string
  granularity: "daily" | "monthly"
  year: number
  monthIndex: number
  daysInMonth: number
  daysElapsed: number
  isCurrentMonth: boolean
  label: string
}

/**
 * Parse a `YYYY-MM` month string (or null for current month) into a billing
 * period with ISO date range, granularity, and display metadata.
 *
 * Granularity is "daily" for recent months (within 58 days) and "monthly" for
 * older months, matching the Neon API's 60-day limit on daily granularity.
 */
export function parseBillingMonth(month: string | null): BillingPeriod {
  const now = new Date()

  let target: Date
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    target = new Date(y, m - 1, 1)
  } else {
    target = startOfMonth(now)
  }

  const from = startOfMonth(target)
  const to = addMonths(from, 1)
  const isCurrentMonth = isSameMonth(from, now)
  const daysInMonth = getDaysInMonth(from)
  const daysElapsed = isCurrentMonth ? getDate(now) : daysInMonth

  const daysAgo = differenceInDays(now, from)
  const granularity = daysAgo > 58 ? ("monthly" as const) : ("daily" as const)

  const effectiveTo = isCurrentMonth ? addDays(startOfMonth(now), daysElapsed) : to

  return {
    from: from.toISOString(),
    to: effectiveTo.toISOString(),
    granularity,
    year: from.getFullYear(),
    monthIndex: from.getMonth(),
    daysInMonth,
    daysElapsed,
    isCurrentMonth,
    label: format(from, "MMMM yyyy"),
  }
}

/**
 * Return the last `count` months as `{ value: "YYYY-MM", label: "Month Year" }`
 * options for a billing period picker.
 */
export function getAvailableMonths(count: number): { value: string; label: string }[] {
  const now = new Date()
  const months: { value: string; label: string }[] = []

  for (let i = 0; i < count; i++) {
    const d = subMonths(startOfMonth(now), i)
    const value = format(d, "yyyy-MM")
    const label = i === 0
      ? `${format(d, "MMMM yyyy")} (current)`
      : format(d, "MMMM yyyy")
    months.push({ value, label })
  }

  return months
}

/** Format a BillingPeriod as `"YYYY-MM"` for URL params. */
export function billingPeriodToParam(bp: BillingPeriod): string {
  return `${bp.year}-${String(bp.monthIndex + 1).padStart(2, "0")}`
}
