import prettyBytes from "pretty-bytes"
import { HOURS_PER_BILLING_PERIOD, BYTES_PER_GB } from "@/lib/pricing"

export function formatBytes(bytes: number): string {
  return prettyBytes(bytes)
}

function formatSecondsToHours(seconds: number): number {
  return seconds / 3600
}

export function formatCUHours(computeUnitSeconds: number): string {
  const hours = formatSecondsToHours(computeUnitSeconds)
  return `${hours.toFixed(2)} CU-hours`
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatBranchMonths(branchHours: number): string {
  const branchMonths = branchHours / HOURS_PER_BILLING_PERIOD
  if (branchMonths < 0.01) return "0 branch-months"
  return `${branchMonths.toFixed(2)} branch-months`
}

export function formatBranchHours(branchHours: number): string {
  return `${branchHours.toLocaleString("en-US", { maximumFractionDigits: 0 })} branch-hours`
}

/**
 * Convert byte-hours to human-readable average storage size.
 */
export function formatStorageFromByteHours(byteHours: number, hoursInPeriod: number): string {
  if (hoursInPeriod === 0) return prettyBytes(0)
  return prettyBytes(byteHours / hoursInPeriod)
}

/**
 * Convert byte-hours to GB-months string for billing display.
 */
export function formatGBMonths(byteHours: number): string {
  const gbMonths = byteHours / HOURS_PER_BILLING_PERIOD / BYTES_PER_GB
  if (gbMonths < 0.005) return "0 GB-months"
  if (gbMonths < 0.1) return `${gbMonths.toFixed(3)} GB-months`
  return `${gbMonths.toFixed(2)} GB-months`
}

/**
 * Format a per-unit rate as a compact display string, e.g. "$0.35/GB-mo".
 * Returns null when the rate is zero (not charged on the plan).
 */
export function formatRate(rate: number, unit: string): string | null {
  if (rate === 0) return null
  return `$${rate}/\u200B${unit}`
}
