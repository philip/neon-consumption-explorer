import { getPlan, normalizePlan, type Plan } from "@/lib/plans"
import { type ConsumptionProject } from "@/lib/api"
import type { ConsumptionMetrics } from "@/lib/types"

/**
 * Extract the org's plan from V2 consumption history response.
 * Falls back to "launch" if no period_plan found (paid API succeeded but no plan field).
 */
export function detectPlanFromConsumption(projects: ConsumptionProject[]): Plan {
  for (const project of projects) {
    for (const period of project.periods) {
      if (period.period_plan) {
        const plan = normalizePlan(period.period_plan)
        if (plan) return plan
      }
    }
  }
  return "launch"
}

/**
 * Standardized billing period length from neon-cloud (31 days x 24 hours).
 * Used to convert byte-hours to byte-months and branch-hours to branch-months.
 */
export const HOURS_PER_BILLING_PERIOD = 744

export const BYTES_PER_GB = 1e9

export function calculateComputeCost(computeUnitSeconds: number, plan: Plan): number {
  const cuHours = computeUnitSeconds / 3600
  return cuHours * getPlan(plan).rates.computePerCUHour
}

/**
 * Calculate storage cost from byte-hours (the raw API sum).
 * Conversion: byte-hours / 744 = byte-months, / 1e9 = GB-months, x rate.
 */
export function calculateStorageCost(byteHours: number, plan: Plan): number {
  const gbMonths = byteHours / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB
  return gbMonths * getPlan(plan).rates.storagePerGBMonth
}

export function calculateInstantRestoreCost(byteHours: number, plan: Plan): number {
  const gbMonths = byteHours / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB
  return gbMonths * getPlan(plan).rates.instantRestorePerGBMonth
}

export function calculatePublicTransferCost(bytes: number, plan: Plan): number {
  const config = getPlan(plan)
  if (config.rates.publicTransferPerGB === 0) return 0
  const gb = bytes / BYTES_PER_GB
  const billableGB = Math.max(0, gb - config.allowances.publicTransferGB)
  return billableGB * config.rates.publicTransferPerGB
}

/**
 * Per-project transfer cost without org-wide allowance deduction.
 * A future improvement could use proportional attribution:
 * (projectGB / orgTotalGB) × max(0, orgTotalGB - allowanceGB) × rate
 */
export function calculatePublicTransferCostRaw(bytes: number, plan: Plan): number {
  const config = getPlan(plan)
  const gb = bytes / BYTES_PER_GB
  return gb * config.rates.publicTransferPerGB
}

export function calculatePrivateTransferCost(bytes: number, plan: Plan): number {
  const gb = bytes / BYTES_PER_GB
  return gb * getPlan(plan).rates.privateTransferPerGB
}

/**
 * Calculate billable extra branch cost from pre-computed billable branch-hours
 * (after subtracting plan allowance per project).
 * Conversion: branch-hours / 744 = branch-months, x rate.
 */
export function calculateExtraBranchesCost(billableBranchHoursTotal: number, plan: Plan): number {
  const branchMonths = billableBranchHoursTotal / HOURS_PER_BILLING_PERIOD
  return branchMonths * getPlan(plan).rates.extraBranchesPerMonth
}

/**
 * For a single project's daily branch-hours value, compute how many
 * branch-hours are billable (beyond plan allowance).
 * API value = child_branches x hours_in_period.
 * Included child branches per project = plan allowance - 1 (root is always included).
 */
export function billableBranchHours(
  rawBranchHours: number,
  hoursInPeriod: number,
  plan: Plan,
): number {
  if (hoursInPeriod === 0) return 0
  const includedChildBranches = getPlan(plan).allowances.branchesPerProject - 1
  const includedHours = includedChildBranches * hoursInPeriod
  return Math.max(0, rawBranchHours - includedHours)
}

/**
 * Convert byte-hours to average bytes for display purposes.
 * hoursInPeriod = number of hours the data covers (e.g. dayCount x 24).
 */
export function byteHoursToAvgBytes(byteHours: number, hoursInPeriod: number): number {
  if (hoursInPeriod === 0) return 0
  return byteHours / hoursInPeriod
}

export type { ConsumptionMetrics } from "@/lib/types"

export function calculateTotalCost(metrics: ConsumptionMetrics, plan: Plan): number {
  return (
    calculateComputeCost(metrics.compute_unit_seconds, plan) +
    calculateStorageCost(metrics.root_branch_byte_hours, plan) +
    calculateStorageCost(metrics.child_branch_byte_hours, plan) +
    calculateInstantRestoreCost(metrics.instant_restore_byte_hours, plan) +
    calculatePublicTransferCost(metrics.public_network_transfer_bytes, plan) +
    calculatePrivateTransferCost(metrics.private_network_transfer_bytes, plan) +
    calculateExtraBranchesCost(metrics.billable_extra_branch_hours, plan)
  )
}
