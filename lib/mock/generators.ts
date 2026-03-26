import { subDays, startOfMonth, addMonths, getDaysInMonth, format } from "date-fns"
import { getPlan } from "@/lib/plans"
import { HOURS_PER_BILLING_PERIOD } from "@/lib/pricing"
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/demo"
import type {
  Organization,
  Project,
  Branch,
  ConsumptionProject,
  ProjectSnapshot,
} from "@/lib/api/queries"

// ---------------------------------------------------------------------------
// Seeded PRNG (deterministic per string key)
// ---------------------------------------------------------------------------

function seedHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

// ---------------------------------------------------------------------------
// Project name generation
// ---------------------------------------------------------------------------

const ADJECTIVES = [
  "azure", "crimson", "golden", "silent", "rapid", "stellar", "cosmic",
  "emerald", "crystal", "shadow", "bright", "swift", "noble", "lunar",
  "coral", "iron", "velvet", "amber", "frost", "cedar", "marble",
  "olive", "sage", "rustic", "polar", "arctic", "autumn", "spring",
]

const NOUNS = [
  "api", "auth", "dashboard", "analytics", "store", "gateway", "engine",
  "service", "worker", "pipeline", "catalog", "search", "notify", "sync",
  "ledger", "vault", "relay", "forge", "atlas", "beacon", "harbor",
  "nexus", "pulse", "orbit", "prism", "ridge", "summit", "creek",
]

function projectName(rng: () => number): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)]
  return `${adj}-${noun}`
}

function projectId(orgId: string, index: number): string {
  return `demo-proj-${orgId}-${String(index).padStart(3, "0")}`
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export function generateOrganizations(): Organization[] {
  return DEMO_SCENARIOS.map((s) => ({
    id: s.orgId,
    name: s.orgName,
    plan: s.plan,
  }))
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function generateProjects(scenario: DemoScenario): Project[] {
  const rng = seededRandom(seedHash(scenario.orgId + "-projects"))
  const now = new Date()
  const periodStart = startOfMonth(now).toISOString()
  const periodEnd = addMonths(startOfMonth(now), 1).toISOString()

  return Array.from({ length: scenario.projectCount }, (_, i) => {
    const id = projectId(scenario.orgId, i)
    const name = projectName(rng)
    const projectShare = distributeProjectShare(rng, scenario.projectCount, i)
    const spend = scenario.monthlySpend * projectShare
    const planConfig = getPlan(scenario.plan)
    const { rates, allowances } = planConfig

    const { weights } = scenario
    const storageWeight = (weights.storageRoot ?? 0) + (weights.storageChild ?? 0)

    const computeSeconds = rates.computePerCUHour > 0
      ? (spend * (weights.compute ?? 0) / rates.computePerCUHour) * 3600
      : (0.2 + rng() * 0.6) * (allowances.computeCUHoursPerProject ?? 100) * 3600

    const storageBH = rates.storagePerGBMonth > 0
      ? (spend * storageWeight / rates.storagePerGBMonth) * HOURS_PER_BILLING_PERIOD * 1e9
      : (0.2 + rng() * 0.6) * (allowances.storageGBPerProject ?? 0.5) * 1e9 * HOURS_PER_BILLING_PERIOD

    const transferBytes = rates.publicTransferPerGB > 0
      ? (spend * (weights.publicTransfer ?? 0) / rates.publicTransferPerGB) * 1e9
      : (0.1 + rng() * 0.5) * (allowances.publicTransferGB / scenario.projectCount) * 1e9

    return {
      id,
      name,
      compute_time_seconds: Math.round(computeSeconds),
      active_time_seconds: Math.round(computeSeconds * 0.6),
      data_storage_bytes_hour: Math.round(storageBH),
      data_transfer_bytes: Math.round(transferBytes),
      written_data_bytes: Math.round(rng() * (allowances.storageGBPerProject ?? 0.5) * 0.5 * 1e9),
      consumption_period_start: periodStart,
      consumption_period_end: periodEnd,
    }
  })
}

/** Distribute total spend across projects with a realistic power-law curve. */
function distributeProjectShare(rng: () => number, count: number, index: number): number {
  const raw = 1 / (index + 1 + rng() * 0.5)
  const total = Array.from({ length: count }, (_, j) => 1 / (j + 1 + 0.25)).reduce((a, b) => a + b, 0)
  return raw / total
}

// ---------------------------------------------------------------------------
// Consumption history
// ---------------------------------------------------------------------------

export function generateConsumptionHistory(
  scenario: DemoScenario,
  params: { from: string; to: string; granularity: string; projectIds?: string[] },
): ConsumptionProject[] {
  const projects = generateProjects(scenario)
  const filtered = params.projectIds
    ? projects.filter((p) => params.projectIds!.includes(p.id))
    : projects

  const fromDate = new Date(params.from)
  const toDate = new Date(params.to)
  const days: string[] = []
  const d = new Date(fromDate)
  while (d < toDate) {
    days.push(d.toISOString())
    d.setDate(d.getDate() + 1)
  }

  if (days.length === 0) return []

  const rates = getPlan(scenario.plan).rates
  const { weights } = scenario
  const allowedBranches = getPlan(scenario.plan).allowances.branchesPerProject - 1

  return filtered.map((proj, projIdx) => {
    const rng = seededRandom(seedHash(proj.id + "-consumption"))
    const share = distributeProjectShare(rng, scenario.projectCount, projIdx)
    const projSpend = scenario.monthlySpend * share
    const fullMonthDays = getDaysInMonth(fromDate)

    const dailyComputeSeconds = rates.computePerCUHour > 0
      ? ((projSpend * (weights.compute ?? 0)) / rates.computePerCUHour * 3600) / fullMonthDays
      : 0
    const dailyStorageRootBH = rates.storagePerGBMonth > 0
      ? ((projSpend * (weights.storageRoot ?? 0)) / rates.storagePerGBMonth * HOURS_PER_BILLING_PERIOD * 1e9) / fullMonthDays
      : 0
    const dailyStorageChildBH = rates.storagePerGBMonth > 0
      ? ((projSpend * (weights.storageChild ?? 0)) / rates.storagePerGBMonth * HOURS_PER_BILLING_PERIOD * 1e9) / fullMonthDays
      : 0
    const dailyPitrBH = rates.instantRestorePerGBMonth > 0
      ? ((projSpend * (weights.storageHistory ?? 0)) / rates.instantRestorePerGBMonth * HOURS_PER_BILLING_PERIOD * 1e9) / fullMonthDays
      : 0
    const dailyPublicTransfer = rates.publicTransferPerGB > 0
      ? ((projSpend * (weights.publicTransfer ?? 0)) / rates.publicTransferPerGB * 1e9) / fullMonthDays
      : 0
    const dailyPrivateTransfer = rates.privateTransferPerGB > 0
      ? ((projSpend * (weights.privateTransfer ?? 0)) / rates.privateTransferPerGB * 1e9) / fullMonthDays
      : 0
    const dailyExtraBranchHours = rates.extraBranchesPerMonth > 0
      ? ((projSpend * (weights.extraBranches ?? 0)) / rates.extraBranchesPerMonth * HOURS_PER_BILLING_PERIOD) / fullMonthDays + allowedBranches * 24
      : 0

    const consumption = days.map((day) => {
      const jitter = 0.8 + rng() * 0.4
      return {
        timeframe_start: day,
        metrics: [
          { metric_name: "compute_unit_seconds", value: Math.round(dailyComputeSeconds * jitter) },
          { metric_name: "root_branch_bytes_month", value: Math.round(dailyStorageRootBH * (0.9 + rng() * 0.2)) },
          { metric_name: "child_branch_bytes_month", value: Math.round(dailyStorageChildBH * (0.9 + rng() * 0.2)) },
          { metric_name: "instant_restore_bytes_month", value: Math.round(dailyPitrBH * (0.9 + rng() * 0.2)) },
          { metric_name: "public_network_transfer_bytes", value: Math.round(dailyPublicTransfer * jitter) },
          { metric_name: "private_network_transfer_bytes", value: Math.round(dailyPrivateTransfer * jitter) },
          { metric_name: "extra_branches_month", value: Math.round(dailyExtraBranchHours * (0.9 + rng() * 0.2)) },
        ],
      }
    })

    return {
      project_id: proj.id,
      periods: [{
        consumption,
        period_plan: scenario.plan,
      }],
    }
  })
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export function generateBranches(
  projectIdStr: string,
  maxTotalStorageBytes = 500 * 1e9,
): Branch[] {
  const rng = seededRandom(seedHash(projectIdStr + "-branches"))
  const count = 1 + Math.floor(rng() * 5)
  const budgetPerBranch = maxTotalStorageBytes * (0.3 + rng() * 0.5) / count

  return Array.from({ length: count }, (_, i) => ({
    id: `${projectIdStr}-br-${i}`,
    name: i === 0 ? "main" : `dev/${ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]}-${Math.floor(rng() * 100)}`,
    logical_size: Math.round((0.1 + rng() * 0.9) * budgetPerBranch),
    current_state: i === 0 || rng() > 0.2 ? "ready" : "idle",
  }))
}

// ---------------------------------------------------------------------------
// Snapshots (for free plan / fallback path)
// ---------------------------------------------------------------------------

export function generateSnapshots(scenario: DemoScenario): ProjectSnapshot[] {
  const projects = generateProjects(scenario)
  return projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    computeTimeSeconds: p.compute_time_seconds ?? 0,
    activeTimeSeconds: p.active_time_seconds ?? 0,
    dataStorageBytesHour: p.data_storage_bytes_hour ?? 0,
    dataTransferBytes: p.data_transfer_bytes ?? 0,
    writtenDataBytes: p.written_data_bytes ?? 0,
    consumptionPeriodStart: p.consumption_period_start ?? "",
    consumptionPeriodEnd: p.consumption_period_end ?? "",
  }))
}
