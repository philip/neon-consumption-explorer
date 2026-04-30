import type { Plan } from "@/lib/plans"
import { getPlan, type PlanConfig } from "@/lib/plans"
import type { ConsumptionMetrics } from "@/lib/types"
import {
  HOURS_PER_BILLING_PERIOD,
  BYTES_PER_GB,
  calculateComputeCost,
  calculateStorageCost,
  calculateInstantRestoreCost,
  calculateSnapshotStorageCost,
  calculatePublicTransferCost,
  calculatePrivateTransferCost,
  calculateExtraBranchesCost,
} from "@/lib/pricing"
import {
  formatCUHours,
  formatGBMonths,
  formatBytes,
  formatBranchMonths,
} from "@/lib/format"

/**
 * Camelcase keys used in DailyDataPoint and chart data.
 * Every MetricDef.dailyKey value appears here.
 */
export type MetricKey =
  | "compute"
  | "storageRoot"
  | "storageChild"
  | "storageHistory"
  | "storageSnapshot"
  | "publicTransfer"
  | "privateTransfer"
  | "extraBranches"

export type ChartUnit = "CU-seconds" | "byte-hours-daily" | "bytes" | "branch-hours"

export type MetricDef = {
  /** metric_name value in the consumption API response */
  apiName: string
  /** Field on DailyDataPoint where the daily accumulated value is stored */
  dailyKey: MetricKey
  /** Field on ConsumptionMetrics where the period total is accumulated */
  totalsKey: keyof ConsumptionMetrics
  /** Rate field in PlanConfig.rates — used for rate-badge display */
  rateKey: keyof PlanConfig["rates"]
  /** Rate unit label shown alongside the rate (e.g. "CU-hr", "GB-mo") */
  rateUnit: string
  /** UI display label */
  label: string
  /** CSS color variable for charts */
  color: string
  /** Semantic unit — controls chart tooltip formatting */
  chartUnit: ChartUnit
  /**
   * Multiplier to convert a daily accumulated value to dollars.
   * dailyCost = value * toCostMultiplier(plan)
   * For `extraBranches` the dailyKey already stores billable hours (post-allowance).
   */
  toCostMultiplier: (plan: Plan) => number
  /**
   * Accurate period-total cost, accounting for plan allowances (e.g. public transfer free tier).
   * Use this for dashboard cards and cost breakdown tables — NOT for per-day chart approximations.
   */
  calculateCost: (periodTotal: number, plan: Plan) => number
  /** Primary display value for dashboard MetricCards (billing unit). */
  formatDisplayValue: (value: number, hoursInPeriod: number) => string
  /** Format the accumulated period-total for cost breakdown tables */
  formatValue: (value: number) => string
  /**
   * True for metrics whose aggregation requires non-trivial per-project logic
   * (e.g. allowance deduction for extraBranches). Accumulation stays explicit in consumption.ts.
   */
  customAggregation?: true
  /**
   * If set, data points whose date is before this ISO date are excluded from
   * cost calculation (metric was free/beta before this date). Usage display
   * is unaffected. ISO 8601 lex compare works for both `timeframe_start`
   * timestamps and chart `date` strings.
   */
  billingStartDate?: string
}

/**
 * True if the metric is billable on the given date. Metrics without a
 * `billingStartDate` are billable on every date. Used by aggregators (with
 * `timeframe_start`), the cost-mode chart helper (with `date`), and the
 * `PaidPlanGuide` to keep the launch-date logic in one place.
 */
export function isMetricBillable(def: MetricDef, isoDate: string): boolean {
  return !def.billingStartDate || isoDate >= def.billingStartDate
}

/**
 * The canonical list of billing metrics.
 *
 * To add a new standard metric:
 *   1. Add one entry here
 *   2. Add the corresponding rate to every plan in lib/plans.ts
 *
 * The API request, daily aggregation, chart config, cost chart, dashboard cards,
 * and cost breakdown table are all derived from this registry automatically.
 */
export const METRICS: MetricDef[] = [
  {
    apiName: "compute_unit_seconds",
    dailyKey: "compute",
    totalsKey: "compute_unit_seconds",
    rateKey: "computePerCUHour",
    rateUnit: "CU-hr",
    label: "Compute",
    color: "var(--chart-1)",
    chartUnit: "CU-seconds",
    toCostMultiplier: (plan) => getPlan(plan).rates.computePerCUHour / 3600,
    calculateCost: (v, plan) => calculateComputeCost(v, plan),
    formatDisplayValue: (v) => formatCUHours(v),
    formatValue: (v) => formatCUHours(v),
  },
  {
    apiName: "root_branch_bytes_month",
    dailyKey: "storageRoot",
    totalsKey: "root_branch_byte_hours",
    rateKey: "storagePerGBMonth",
    rateUnit: "GB-mo",
    label: "Root Storage",
    color: "var(--chart-2)",
    chartUnit: "byte-hours-daily",
    toCostMultiplier: (plan) =>
      getPlan(plan).rates.storagePerGBMonth / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB,
    calculateCost: (v, plan) => calculateStorageCost(v, plan),
    formatDisplayValue: (v) => formatGBMonths(v),
    formatValue: (v) => formatGBMonths(v),
  },
  {
    apiName: "child_branch_bytes_month",
    dailyKey: "storageChild",
    totalsKey: "child_branch_byte_hours",
    rateKey: "storagePerGBMonth",
    rateUnit: "GB-mo",
    label: "Child Storage",
    color: "var(--chart-3)",
    chartUnit: "byte-hours-daily",
    toCostMultiplier: (plan) =>
      getPlan(plan).rates.storagePerGBMonth / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB,
    calculateCost: (v, plan) => calculateStorageCost(v, plan),
    formatDisplayValue: (v) => formatGBMonths(v),
    formatValue: (v) => formatGBMonths(v),
  },
  {
    apiName: "instant_restore_bytes_month",
    dailyKey: "storageHistory",
    totalsKey: "instant_restore_byte_hours",
    rateKey: "instantRestorePerGBMonth",
    rateUnit: "GB-mo",
    label: "PITR / Instant Restore",
    color: "var(--chart-4)",
    chartUnit: "byte-hours-daily",
    toCostMultiplier: (plan) =>
      getPlan(plan).rates.instantRestorePerGBMonth / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB,
    calculateCost: (v, plan) => calculateInstantRestoreCost(v, plan),
    formatDisplayValue: (v) => formatGBMonths(v),
    formatValue: (v) => formatGBMonths(v),
  },
  {
    apiName: "snapshot_storage_bytes_month",
    billingStartDate: "2026-05-01",
    dailyKey: "storageSnapshot",
    totalsKey: "snapshot_storage_byte_hours",
    rateKey: "snapshotsPerGBMonth",
    rateUnit: "GB-mo",
    label: "Snapshots",
    color: "var(--chart-3)",
    chartUnit: "byte-hours-daily",
    toCostMultiplier: (plan) =>
      getPlan(plan).rates.snapshotsPerGBMonth / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB,
    calculateCost: (v, plan) => calculateSnapshotStorageCost(v, plan),
    formatDisplayValue: (v) => formatGBMonths(v),
    formatValue: (v) => formatGBMonths(v),
  },
  {
    apiName: "public_network_transfer_bytes",
    dailyKey: "publicTransfer",
    totalsKey: "public_network_transfer_bytes",
    rateKey: "publicTransferPerGB",
    rateUnit: "GB",
    label: "Public Transfer",
    color: "var(--chart-5)",
    chartUnit: "bytes",
    toCostMultiplier: (plan) => getPlan(plan).rates.publicTransferPerGB / BYTES_PER_GB,
    calculateCost: (v, plan) => calculatePublicTransferCost(v, plan),
    formatDisplayValue: (v) => formatBytes(v),
    formatValue: (v) => formatBytes(v),
  },
  {
    apiName: "private_network_transfer_bytes",
    dailyKey: "privateTransfer",
    totalsKey: "private_network_transfer_bytes",
    rateKey: "privateTransferPerGB",
    rateUnit: "GB",
    label: "Private Transfer",
    color: "var(--chart-1)",
    chartUnit: "bytes",
    toCostMultiplier: (plan) => getPlan(plan).rates.privateTransferPerGB / BYTES_PER_GB,
    calculateCost: (v, plan) => calculatePrivateTransferCost(v, plan),
    formatDisplayValue: (v) => formatBytes(v),
    formatValue: (v) => formatBytes(v),
  },
  {
    apiName: "extra_branches_month",
    dailyKey: "extraBranches",
    totalsKey: "billable_extra_branch_hours",
    rateKey: "extraBranchesPerMonth",
    rateUnit: "mo",
    label: "Extra Branches",
    color: "var(--chart-2)",
    chartUnit: "branch-hours",
    toCostMultiplier: (plan) =>
      getPlan(plan).rates.extraBranchesPerMonth / HOURS_PER_BILLING_PERIOD,
    calculateCost: (v, plan) => calculateExtraBranchesCost(v, plan),
    // Dashboard MetricCard for Extra Branches is kept explicit in dashboard/page.tsx
    // because its subtitle requires totals.total_branch_hours (not in per-metric totals).
    formatDisplayValue: (v) => formatBranchMonths(v),
    formatValue: (v) => formatBranchMonths(v),
    customAggregation: true,
  },
]

/** API metric names to include in every consumption history request. Derived from METRICS. */
export const METRIC_API_NAMES: string[] = METRICS.map((m) => m.apiName)

/** Lookup a MetricDef by its API metric_name. */
export const METRIC_BY_API_NAME = new Map<string, MetricDef>(
  METRICS.map((m) => [m.apiName, m]),
)
