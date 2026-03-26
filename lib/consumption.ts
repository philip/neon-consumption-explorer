import { billableBranchHours } from "@/lib/pricing"
import type { ConsumptionMetrics } from "@/lib/types"
import type { Plan } from "@/lib/plans"
import { METRICS, METRIC_BY_API_NAME, type MetricKey } from "@/lib/metrics"
import { type ConsumptionProject } from "@/lib/api"

/** Assumes daily granularity — all API calls in this app use granularity=daily. */
const HOURS_PER_DAY = 24

export type ProjectConsumption = ConsumptionProject

/** One data point per day, keyed by the registry's MetricKey values. */
export type DailyDataPoint = { date: string } & Record<MetricKey, number>

/**
 * Aggregate V2 consumption history across all projects into daily data points
 * and running totals. Used by the dashboard overview and project time-series.
 */
export function aggregateConsumption(
  projects: ProjectConsumption[],
  plan: Plan,
): { daily: DailyDataPoint[]; totals: ConsumptionMetrics; dayCount: number } {
  const dailyMap: Record<string, DailyDataPoint> = {}

  const totals: ConsumptionMetrics = {
    ...Object.fromEntries(METRICS.map((m) => [m.totalsKey, 0])),
    total_branch_hours: 0,
  } as ConsumptionMetrics

  for (const project of projects) {
    for (const period of project.periods) {
      for (const day of period.consumption) {
        const key = day.timeframe_start
        if (!dailyMap[key]) {
          // Zero-initialize all metric fields from the registry so new metrics
          // are automatically included without editing this function.
          const zeros = Object.fromEntries(METRICS.map((m) => [m.dailyKey, 0]))
          dailyMap[key] = { date: key, ...zeros } as DailyDataPoint
        }
        const d = dailyMap[key]
        let rawBranchHoursForProject = 0
        for (const m of day.metrics) {
          const def = METRIC_BY_API_NAME.get(m.metric_name)
          if (def && !def.customAggregation) {
            // Standard metric: accumulate into daily point and period totals.
            d[def.dailyKey] += m.value
            totals[def.totalsKey] += m.value
          } else if (m.metric_name === "extra_branches_month") {
            // Custom aggregation: allowance deduction happens after the inner loop.
            rawBranchHoursForProject += m.value
          }
        }
        const billable = billableBranchHours(rawBranchHoursForProject, HOURS_PER_DAY, plan)
        d.extraBranches += billable
        totals.total_branch_hours += rawBranchHoursForProject
        totals.billable_extra_branch_hours += billable
      }
    }
  }

  const daily = Object.values(dailyMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  return { daily, totals, dayCount: daily.length }
}

/**
 * Aggregate per-project consumption into per-metric totals.
 * `totals` keys match MetricKey (same as DailyDataPoint).
 * `extraBranches` stores billable branch-hours (after plan allowance deduction).
 */
export function aggregateProjectMetrics(
  project: ProjectConsumption,
  plan: Plan,
): { totals: Record<MetricKey, number>; dayCount: number } {
  const totals = Object.fromEntries(METRICS.map((m) => [m.dailyKey, 0])) as Record<MetricKey, number>
  const days = new Set<string>()

  for (const period of project.periods) {
    for (const day of period.consumption) {
      days.add(day.timeframe_start)
      let dailyBranchHours = 0
      for (const m of day.metrics) {
        const def = METRIC_BY_API_NAME.get(m.metric_name)
        if (def && !def.customAggregation) {
          totals[def.dailyKey] += m.value
        } else if (m.metric_name === "extra_branches_month") {
          dailyBranchHours += m.value
        }
      }
      totals.extraBranches += billableBranchHours(dailyBranchHours, HOURS_PER_DAY, plan)
    }
  }

  return { totals, dayCount: days.size }
}
