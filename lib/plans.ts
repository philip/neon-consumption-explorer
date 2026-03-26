export type Plan = "free" | "launch" | "scale"

export function isPlan(value: string): value is Plan {
  return normalizePlan(value) !== null
}

/**
 * Normalize API subscription type strings, scale ftw
 */
export function normalizePlan(value: string): Plan | null {
  if (value in PLANS) return value as Plan
  if (value.startsWith("free")) return "free"
  if (value.startsWith("launch")) return "launch"
  if (value.startsWith("scale")) return "scale"
  if (value.startsWith("business")) return "scale"
  if (value.startsWith("enterprise") || value.startsWith("direct_sales")) return "scale"
  if (value === "aws_marketplace") return "scale"
  return null
}

export type PlanConfig = {
  label: string
  isPaid: boolean
  hasPrivateNetworking: boolean

  /** Per-unit rates. Zero means not available/not charged on this plan. */
  rates: {
    computePerCUHour: number
    storagePerGBMonth: number
    instantRestorePerGBMonth: number
    snapshotsPerGBMonth: number
    publicTransferPerGB: number
    privateTransferPerGB: number
    extraBranchesPerMonth: number
  }

  /**
   * What's included before charges begin (paid plans) or hard caps (free plan).
   * On free plan, exceeding these suspends compute or blocks creation.
   * On paid plans, usage beyond allowances is billed at the rates above.
   */
  allowances: {
    projects: number
    branchesPerProject: number
    computeCUHoursPerProject: number | null
    storageGBPerProject: number | null
    publicTransferGB: number
    maxRestoreWindowDays: number
    /** Max PITR history size in GB-months. null = unlimited (pay per use on paid plans). */
    maxRestoreHistoryGBMonth: number | null
    /** Manual snapshot limit. Scheduled backups don't count toward this on paid plans. */
    maxManualSnapshots: number
  }
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    label: "Free",
    isPaid: false,
    hasPrivateNetworking: false,
    rates: {
      computePerCUHour: 0,
      storagePerGBMonth: 0,
      instantRestorePerGBMonth: 0,
      snapshotsPerGBMonth: 0,
      publicTransferPerGB: 0,
      privateTransferPerGB: 0,
      extraBranchesPerMonth: 0,
    },
    allowances: {
      projects: 100,
      branchesPerProject: 10,
      computeCUHoursPerProject: 100,
      storageGBPerProject: 0.5,
      publicTransferGB: 5,
      maxRestoreWindowDays: 0.25,
      maxRestoreHistoryGBMonth: 1,
      maxManualSnapshots: 1,
    },
  },
  launch: {
    label: "Launch",
    isPaid: true,
    hasPrivateNetworking: false,
    rates: {
      computePerCUHour: 0.106,
      storagePerGBMonth: 0.35,
      instantRestorePerGBMonth: 0.20,
      snapshotsPerGBMonth: 0.09,
      publicTransferPerGB: 0.10,
      privateTransferPerGB: 0,
      extraBranchesPerMonth: 1.50,
    },
    allowances: {
      projects: 100,
      branchesPerProject: 10,
      computeCUHoursPerProject: null,
      storageGBPerProject: null,
      publicTransferGB: 100,
      maxRestoreWindowDays: 7,
      maxRestoreHistoryGBMonth: null,
      maxManualSnapshots: 10,
    },
  },
  scale: {
    label: "Scale",
    isPaid: true,
    hasPrivateNetworking: true,
    rates: {
      computePerCUHour: 0.222,
      storagePerGBMonth: 0.35,
      instantRestorePerGBMonth: 0.20,
      snapshotsPerGBMonth: 0.09,
      publicTransferPerGB: 0.10,
      privateTransferPerGB: 0.01,
      extraBranchesPerMonth: 1.50,
    },
    allowances: {
      projects: 1000,
      branchesPerProject: 25,
      computeCUHoursPerProject: null,
      storageGBPerProject: null,
      publicTransferGB: 100,
      maxRestoreWindowDays: 30,
      maxRestoreHistoryGBMonth: null,
      maxManualSnapshots: 10,
    },
  },
}

export function getPlan(plan: Plan): PlanConfig {
  return PLANS[plan] ?? PLANS.free
}
