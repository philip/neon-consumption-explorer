import type { Plan } from "@/lib/plans"
import type { MetricKey } from "@/lib/metrics"

export function isDemoMode(): boolean {
  return !process.env.NEON_API_KEY
}

export type DemoScenario = {
  orgId: string
  orgName: string
  plan: Plan
  projectCount: number
  /** Target monthly spend in dollars (used to back-calculate metric values). */
  monthlySpend: number
  /**
   * Distribution of spend across metrics, keyed by MetricKey.
   * Values should sum to ~1. Omitted keys default to 0.
   * storageRoot and storageChild are split 70/30 of combined storage weight by the generator.
   */
  weights: Partial<Record<MetricKey, number>>
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    orgId: "demo-free",
    orgName: "Free plan",
    plan: "free",
    projectCount: 5,
    monthlySpend: 0,
    weights: {},
  },
  {
    orgId: "demo-launch-light",
    orgName: "Launch plan, ~$15/mo",
    plan: "launch",
    projectCount: 3,
    monthlySpend: 15,
    weights: { compute: 0.68, storageRoot: 0.105, storageChild: 0.045, storageHistory: 0.05, storageSnapshot: 0.02, publicTransfer: 0.10 },
  },
  {
    orgId: "demo-launch-heavy",
    orgName: "Launch plan, ~$150/mo",
    plan: "launch",
    projectCount: 12,
    monthlySpend: 150,
    weights: { compute: 0.52, storageRoot: 0.14, storageChild: 0.06, storageHistory: 0.10, storageSnapshot: 0.03, publicTransfer: 0.10, extraBranches: 0.05 },
  },
  {
    orgId: "demo-scale-heavy",
    orgName: "Scale plan, ~$500/mo",
    plan: "scale",
    projectCount: 25,
    monthlySpend: 500,
    weights: { compute: 0.46, storageRoot: 0.14, storageChild: 0.06, storageHistory: 0.10, storageSnapshot: 0.04, publicTransfer: 0.08, privateTransfer: 0.02, extraBranches: 0.10 },
  },
]

export function getScenario(orgId: string): DemoScenario {
  return DEMO_SCENARIOS.find((s) => s.orgId === orgId) ?? DEMO_SCENARIOS[0]
}
