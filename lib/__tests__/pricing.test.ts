import { describe, it, expect } from "vitest"
import {
  calculateComputeCost,
  calculateStorageCost,
  calculateSnapshotStorageCost,
  calculatePublicTransferCost,
  billableBranchHours,
  calculateTotalCost,
  HOURS_PER_BILLING_PERIOD,
} from "@/lib/pricing"
import { aggregateConsumption } from "@/lib/consumption"
import { isMetricBillable, METRIC_BY_API_NAME } from "@/lib/metrics"
import type { ConsumptionProject } from "@/lib/api"

describe("calculateComputeCost", () => {
  it("converts seconds to CU-hours and multiplies by rate", () => {
    // launch rate: $0.106/CU-hour; 3600s = 1 CU-hour
    expect(calculateComputeCost(3600, "launch")).toBeCloseTo(0.106)
  })

  it("returns 0 for free plan (rate is 0)", () => {
    expect(calculateComputeCost(3600 * 100, "free")).toBe(0)
  })
})

describe("calculateStorageCost", () => {
  it("converts byte-hours to GB-months and multiplies by rate", () => {
    // 1 GB for a full billing period = 1 GB-month = $0.35 on launch
    const byteHours = 1e9 * HOURS_PER_BILLING_PERIOD
    expect(calculateStorageCost(byteHours, "launch")).toBeCloseTo(0.35)
  })
})

describe("calculateSnapshotStorageCost", () => {
  it("converts snapshot byte-hours to GB-months and multiplies by rate", () => {
    // 1 GB for a full billing period = 1 GB-month = $0.09 on launch and scale
    const byteHours = 1e9 * HOURS_PER_BILLING_PERIOD
    expect(calculateSnapshotStorageCost(byteHours, "launch")).toBeCloseTo(0.09)
    expect(calculateSnapshotStorageCost(byteHours, "scale")).toBeCloseTo(0.09)
  })

  it("returns 0 for free plan (rate is 0)", () => {
    const byteHours = 1e9 * HOURS_PER_BILLING_PERIOD
    expect(calculateSnapshotStorageCost(byteHours, "free")).toBe(0)
  })
})

describe("calculatePublicTransferCost", () => {
  it("charges nothing within the free allowance", () => {
    // launch: 100 GB free; 50 GB used
    expect(calculatePublicTransferCost(50e9, "launch")).toBe(0)
  })

  it("charges only bytes beyond the allowance", () => {
    // launch: 100 GB free, $0.10/GB; 150 GB used → 50 GB billable
    expect(calculatePublicTransferCost(150e9, "launch")).toBeCloseTo(5.0)
  })
})

describe("billableBranchHours", () => {
  it("returns 0 when branch usage is within plan allowance", () => {
    // launch: 10 branches/project, 9 included child branches; 8 child branches * 24h = 192h
    expect(billableBranchHours(192, 24, "launch")).toBe(0)
  })

  it("returns excess hours beyond the allowance", () => {
    // launch: 9 included child branches; 10 children * 24h used = 240h; 1 child * 24h = 24h billable
    expect(billableBranchHours(240, 24, "launch")).toBe(24)
  })

  it("returns 0 when hoursInPeriod is 0", () => {
    expect(billableBranchHours(1000, 0, "launch")).toBe(0)
  })
})

describe("calculateTotalCost", () => {
  it("sums all cost components", () => {
    const computeCost = calculateComputeCost(3600, "launch") // $0.106
    const total = calculateTotalCost(
      {
        compute_unit_seconds: 3600,
        root_branch_byte_hours: 0,
        child_branch_byte_hours: 0,
        instant_restore_byte_hours: 0,
        snapshot_storage_byte_hours: 0,
        public_network_transfer_bytes: 0,
        private_network_transfer_bytes: 0,
        total_branch_hours: 0,
        billable_extra_branch_hours: 0,
      },
      "launch",
    )
    expect(total).toBeCloseTo(computeCost)
  })
})

describe("aggregateConsumption", () => {
  const project: ConsumptionProject = {
    project_id: "p1",
    periods: [
      {
        consumption: [
          {
            timeframe_start: "2024-01-01T00:00:00Z",
            metrics: [
              { metric_name: "compute_unit_seconds", value: 7200 },
              { metric_name: "public_network_transfer_bytes", value: 1e9 },
            ],
          },
        ],
      },
    ],
  }

  it("sums metrics across projects into totals", () => {
    const { totals, billableTotals } = aggregateConsumption([project], "launch")
    expect(totals.compute_unit_seconds).toBe(7200)
    expect(totals.public_network_transfer_bytes).toBe(1e9)
    // Non-marked metrics: totals and billableTotals stay in sync.
    expect(billableTotals.compute_unit_seconds).toBe(7200)
    expect(billableTotals.public_network_transfer_bytes).toBe(1e9)
  })

  it("aggregates pre-launch snapshot data into totals but excludes from billableTotals", () => {
    const projectWithSnapshots: ConsumptionProject = {
      project_id: "p2",
      periods: [
        {
          consumption: [
            {
              timeframe_start: "2024-01-01T00:00:00Z",
              metrics: [
                { metric_name: "snapshot_storage_bytes_month", value: 5e10 },
              ],
            },
          ],
        },
      ],
    }
    const { totals, billableTotals } = aggregateConsumption([projectWithSnapshots], "launch")
    expect(totals.snapshot_storage_byte_hours).toBe(5e10)
    expect(billableTotals.snapshot_storage_byte_hours).toBe(0)
  })

  it("includes on/after billingStartDate snapshot data in both totals and billableTotals", () => {
    const projectWithSnapshots: ConsumptionProject = {
      project_id: "p3",
      periods: [
        {
          consumption: [
            {
              timeframe_start: "2026-05-01T00:00:00Z",
              metrics: [
                { metric_name: "snapshot_storage_bytes_month", value: 5e10 },
              ],
            },
          ],
        },
      ],
    }
    const { totals, billableTotals } = aggregateConsumption([projectWithSnapshots], "launch")
    expect(totals.snapshot_storage_byte_hours).toBe(5e10)
    expect(billableTotals.snapshot_storage_byte_hours).toBe(5e10)
  })

  it("splits mixed-boundary snapshot data correctly", () => {
    const projectAcrossLaunch: ConsumptionProject = {
      project_id: "p4",
      periods: [
        {
          consumption: [
            {
              timeframe_start: "2026-04-30T00:00:00Z",
              metrics: [
                { metric_name: "snapshot_storage_bytes_month", value: 3e10 },
              ],
            },
            {
              timeframe_start: "2026-05-01T00:00:00Z",
              metrics: [
                { metric_name: "snapshot_storage_bytes_month", value: 7e10 },
              ],
            },
          ],
        },
      ],
    }
    const { totals, billableTotals } = aggregateConsumption([projectAcrossLaunch], "launch")
    expect(totals.snapshot_storage_byte_hours).toBe(1e11)
    expect(billableTotals.snapshot_storage_byte_hours).toBe(7e10)
  })

  it("returns one daily data point per distinct date", () => {
    const { daily } = aggregateConsumption([project], "launch")
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe("2024-01-01T00:00:00Z")
  })

  it("returns empty results for no projects", () => {
    const { daily, totals, billableTotals, dayCount } = aggregateConsumption([], "launch")
    expect(daily).toHaveLength(0)
    expect(dayCount).toBe(0)
    expect(totals.compute_unit_seconds).toBe(0)
    expect(billableTotals.compute_unit_seconds).toBe(0)
  })
})

describe("isMetricBillable", () => {
  const snapshot = METRIC_BY_API_NAME.get("snapshot_storage_bytes_month")!
  const compute = METRIC_BY_API_NAME.get("compute_unit_seconds")!

  it("returns false for snapshots before 2026-05-01", () => {
    expect(isMetricBillable(snapshot, "2026-04-30T23:59:59Z")).toBe(false)
    expect(isMetricBillable(snapshot, "2024-01-01T00:00:00Z")).toBe(false)
  })

  it("returns true for snapshots on or after 2026-05-01", () => {
    expect(isMetricBillable(snapshot, "2026-05-01T00:00:00Z")).toBe(true)
    expect(isMetricBillable(snapshot, "2026-06-15T12:00:00Z")).toBe(true)
  })

  it("returns true for metrics without billingStartDate on every date", () => {
    expect(isMetricBillable(compute, "2020-01-01T00:00:00Z")).toBe(true)
    expect(isMetricBillable(compute, "2030-01-01T00:00:00Z")).toBe(true)
  })

  it("accepts date-only strings (chart `date` form)", () => {
    expect(isMetricBillable(snapshot, "2026-04-30")).toBe(false)
    expect(isMetricBillable(snapshot, "2026-05-01")).toBe(true)
  })
})
