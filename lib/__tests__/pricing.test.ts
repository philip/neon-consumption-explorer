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
    const { totals } = aggregateConsumption([project], "launch")
    expect(totals.compute_unit_seconds).toBe(7200)
    expect(totals.public_network_transfer_bytes).toBe(1e9)
  })

  it("aggregates snapshot_storage_bytes_month into snapshot_storage_byte_hours", () => {
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
    const { totals } = aggregateConsumption([projectWithSnapshots], "launch")
    expect(totals.snapshot_storage_byte_hours).toBe(5e10)
  })

  it("returns one daily data point per distinct date", () => {
    const { daily } = aggregateConsumption([project], "launch")
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe("2024-01-01T00:00:00Z")
  })

  it("returns empty results for no projects", () => {
    const { daily, totals, dayCount } = aggregateConsumption([], "launch")
    expect(daily).toHaveLength(0)
    expect(dayCount).toBe(0)
    expect(totals.compute_unit_seconds).toBe(0)
  })
})
