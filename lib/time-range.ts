import { subDays, subMonths } from "date-fns"
import type { TimePresetKey, Granularity } from "@/lib/search-params"
import { TIME_PRESETS } from "@/lib/search-params"

export function computeTimeRange(preset: TimePresetKey): {
  granularity: Granularity
  from: string
  to: string
} {
  const now = new Date()
  const granularity = TIME_PRESETS[preset].granularity

  if (preset === "12m") {
    const firstOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    )
    const start = subMonths(firstOfNextMonth, 12)
    return {
      granularity,
      from: start.toISOString(),
      to: firstOfNextMonth.toISOString(),
    }
  }

  const toDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  const daysBack = preset === "7d" ? 7 : preset === "30d" ? 30 : 60
  const start = subDays(toDate, daysBack)
  return { granularity, from: start.toISOString(), to: toDate.toISOString() }
}
