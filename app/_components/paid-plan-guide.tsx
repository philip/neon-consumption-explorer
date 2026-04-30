import {
  formatBytes,
  formatCurrency,
  formatCUHours,
  formatAvgCU,
  formatGBMonths,
  formatBranchHours,
  formatBranchMonths,
} from "@/lib/format"
import {
  calculateComputeCost,
  calculateStorageCost,
  calculateInstantRestoreCost,
  calculateSnapshotStorageCost,
  calculatePublicTransferCost,
  calculatePrivateTransferCost,
  calculateExtraBranchesCost,
  billableBranchHours,
} from "@/lib/pricing"
import { getPlan, type Plan } from "@/lib/plans"
import type { BillingPeriod } from "@/lib/billing-period"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricExplainer } from "@/components/metric-explainer"
import { CurlBlock } from "@/components/curl-block"
import { ConsumptionFieldCard } from "@/components/consumption-field-card"
import type { ProjectConsumption } from "@/lib/consumption"
import { METRIC_BY_API_NAME, isMetricBillable } from "@/lib/metrics"

const SNAPSHOT_METRIC = METRIC_BY_API_NAME.get("snapshot_storage_bytes_month")!

export function PaidPlanGuide({
  projects,
  plan,
  billingPeriod,
  totalActiveSeconds,
}: {
  projects: ProjectConsumption[]
  plan: Plan
  billingPeriod: BillingPeriod
  totalActiveSeconds: number | null
}) {
  const planConfig = getPlan(plan)
  const pricing = planConfig.rates

  let computeSeconds = 0
  let rootStorageBH = 0
  let childStorageBH = 0
  let pitrBH = 0
  let snapshotBH = 0
  // Cost-only accumulator for snapshots: excludes pre-launch beta dates.
  let snapshotBillableBH = 0
  let publicTransfer = 0
  let privateTransfer = 0
  let totalBillableBranchHours = 0
  let totalBranchHours = 0

  for (const project of projects) {
    for (const period of project.periods) {
      for (const day of period.consumption) {
        let dailyBH = 0
        for (const m of day.metrics) {
          switch (m.metric_name) {
            case "compute_unit_seconds":
              computeSeconds += m.value
              break
            case "root_branch_bytes_month":
              rootStorageBH += m.value
              break
            case "child_branch_bytes_month":
              childStorageBH += m.value
              break
            case "instant_restore_bytes_month":
              pitrBH += m.value
              break
            case "snapshot_storage_bytes_month":
              snapshotBH += m.value
              if (isMetricBillable(SNAPSHOT_METRIC, day.timeframe_start)) {
                snapshotBillableBH += m.value
              }
              break
            case "public_network_transfer_bytes":
              publicTransfer += m.value
              break
            case "private_network_transfer_bytes":
              privateTransfer += m.value
              break
            case "extra_branches_month":
              dailyBH += m.value
              totalBranchHours += m.value
              break
          }
        }
        totalBillableBranchHours += billableBranchHours(dailyBH, 24, plan)
      }
    }
  }

  const avgCU = totalActiveSeconds != null
    ? formatAvgCU(computeSeconds, totalActiveSeconds)
    : null
  const computeCost = calculateComputeCost(computeSeconds, plan)
  const rootStorageCost = calculateStorageCost(rootStorageBH, plan)
  const childStorageCost = calculateStorageCost(childStorageBH, plan)
  const pitrCost = calculateInstantRestoreCost(pitrBH, plan)
  const snapshotCost = calculateSnapshotStorageCost(snapshotBillableBH, plan)
  const snapshotHasPreLaunchUsage = snapshotBH > 0 && snapshotBillableBH < snapshotBH
  const pubTransferCost = calculatePublicTransferCost(publicTransfer, plan)
  const privTransferCost = calculatePrivateTransferCost(privateTransfer, plan)
  const branchCost = calculateExtraBranchesCost(totalBillableBranchHours, plan)
  const totalCost = computeCost + rootStorageCost + childStorageCost + pitrCost + snapshotCost + pubTransferCost + privTransferCost + branchCost

  const curlBase = `curl "https://console.neon.tech/api/v2/consumption_history/v2/projects?\\
org_id=\${ORG_ID}&from=${billingPeriod.from}&to=${billingPeriod.to}&\\
granularity=${billingPeriod.granularity}`

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Estimated Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatCurrency(totalCost)}</span>
            <span className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
              {billingPeriod.isCurrentMonth
                ? ` (${billingPeriod.daysElapsed} of ${billingPeriod.daysInMonth} days)`
                : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Per-Metric Breakdown</h2>

        <MetricExplainer
          title="Compute"
          apiField="compute_unit_seconds"
          rawValue={`${computeSeconds.toLocaleString()} seconds`}
          interpretation={avgCU ? `${formatCUHours(computeSeconds)} (${avgCU})` : formatCUHours(computeSeconds)}
          formula={[
            `API reports compute in CU-seconds (compute-unit seconds).`,
            `Convert to CU-hours: ${computeSeconds.toLocaleString()} s ÷ 3,600 = ${(computeSeconds / 3600).toFixed(2)} CU-hrs.`,
            `Cost: ${(computeSeconds / 3600).toFixed(2)} CU-hrs × $${pricing.computePerCUHour}/CU-hr`,
          ].join("\n")}
          cost={formatCurrency(computeCost)}
          curl={`${curlBase}&metrics=compute_unit_seconds&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="Root Storage"
          apiField="root_branch_bytes_month"
          rawValue={`${rootStorageBH.toExponential(2)} byte-hours`}
          interpretation={formatGBMonths(rootStorageBH)}
          formula={[
            `API reports storage as byte-hours (bytes stored × hours held).`,
            `Convert to GB-months: byte-hours ÷ 744 hrs ÷ 1,000,000,000 = ${formatGBMonths(rootStorageBH)}.`,
            `Cost: ${formatGBMonths(rootStorageBH)} × $${pricing.storagePerGBMonth}/GB-mo`,
          ].join("\n")}
          cost={formatCurrency(rootStorageCost)}
          curl={`${curlBase}&metrics=root_branch_bytes_month&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="Child Storage"
          apiField="child_branch_bytes_month"
          rawValue={`${childStorageBH.toExponential(2)} byte-hours`}
          interpretation={formatGBMonths(childStorageBH)}
          formula={[
            `API reports child-branch storage as byte-hours (bytes stored × hours held).`,
            `Convert to GB-months: byte-hours ÷ 744 hrs ÷ 1,000,000,000 = ${formatGBMonths(childStorageBH)}.`,
            `Cost: ${formatGBMonths(childStorageBH)} × $${pricing.storagePerGBMonth}/GB-mo`,
          ].join("\n")}
          cost={formatCurrency(childStorageCost)}
          curl={`${curlBase}&metrics=child_branch_bytes_month&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="PITR / Instant Restore"
          apiField="instant_restore_bytes_month"
          rawValue={`${pitrBH.toExponential(2)} byte-hours`}
          interpretation={formatGBMonths(pitrBH)}
          formula={[
            `API reports PITR history as byte-hours (bytes retained × hours held).`,
            `Convert to GB-months: byte-hours ÷ 744 hrs ÷ 1,000,000,000 = ${formatGBMonths(pitrBH)}.`,
            `Cost: ${formatGBMonths(pitrBH)} × $${pricing.instantRestorePerGBMonth}/GB-mo`,
          ].join("\n")}
          cost={formatCurrency(pitrCost)}
          curl={`${curlBase}&metrics=instant_restore_bytes_month&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="Snapshots"
          apiField="snapshot_storage_bytes_month"
          rawValue={`${snapshotBH.toExponential(2)} byte-hours`}
          interpretation={formatGBMonths(snapshotBH)}
          formula={[
            `API reports snapshot storage as byte-hours.`,
            `Manual snapshots and the first scheduled snapshot contribute their full logical size.`,
            `Subsequent scheduled snapshots contribute only the diff since the previous one.`,
            `Convert to GB-months: byte-hours ÷ 744 hrs ÷ 1,000,000,000 = ${formatGBMonths(snapshotBH)}.`,
            `Cost: ${formatGBMonths(snapshotBillableBH)} × $${pricing.snapshotsPerGBMonth}/GB-mo`,
            ...(snapshotHasPreLaunchUsage
              ? [`Note: snapshots became billable on ${SNAPSHOT_METRIC.billingStartDate}. Pre-launch usage (${formatGBMonths(snapshotBH - snapshotBillableBH)}) is shown above but not charged.`]
              : []),
          ].join("\n")}
          cost={formatCurrency(snapshotCost)}
          curl={`${curlBase}&metrics=snapshot_storage_bytes_month&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="Extra Branches"
          apiField="extra_branches_month"
          rawValue={formatBranchHours(totalBranchHours)}
          interpretation={`${formatBranchMonths(totalBillableBranchHours)} billable (after ${planConfig.allowances.branchesPerProject} branch/project allowance)`}
          formula={[
            `Each project includes ${planConfig.allowances.branchesPerProject} branches (${planConfig.allowances.branchesPerProject - 1} child + root).`,
            `Daily free allowance = ${planConfig.allowances.branchesPerProject - 1} child branches × 24 hrs = ${(planConfig.allowances.branchesPerProject - 1) * 24} branch-hrs.`,
            `Billable per project/day = max(0, reported branch-hrs − ${(planConfig.allowances.branchesPerProject - 1) * 24}).`,
            `Total: ${totalBillableBranchHours.toLocaleString()} billable branch-hrs ÷ 744 × $${pricing.extraBranchesPerMonth}/mo`,
          ].join("\n")}
          cost={formatCurrency(branchCost)}
          curl={`${curlBase}&metrics=extra_branches_month&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <MetricExplainer
          title="Public Network Transfer"
          apiField="public_network_transfer_bytes"
          rawValue={formatBytes(publicTransfer)}
          interpretation={`${planConfig.allowances.publicTransferGB} GB free, then $${pricing.publicTransferPerGB}/GB`}
          formula={[
            `API reports transfer in bytes.`,
            `Convert to GB: ${publicTransfer.toLocaleString()} bytes ÷ 1,000,000,000 = ${(publicTransfer / 1e9).toFixed(2)} GB.`,
            `Free allowance: ${planConfig.allowances.publicTransferGB} GB.`,
            `Billable: max(0, ${(publicTransfer / 1e9).toFixed(2)} GB − ${planConfig.allowances.publicTransferGB} GB) = ${Math.max(0, publicTransfer / 1e9 - planConfig.allowances.publicTransferGB).toFixed(2)} GB.`,
            `Cost: ${Math.max(0, publicTransfer / 1e9 - planConfig.allowances.publicTransferGB).toFixed(2)} GB × $${pricing.publicTransferPerGB}/GB`,
          ].join("\n")}
          cost={formatCurrency(pubTransferCost)}
        />

        {planConfig.hasPrivateNetworking && (
          <MetricExplainer
            title="Private Network Transfer"
            apiField="private_network_transfer_bytes"
            rawValue={formatBytes(privateTransfer)}
            interpretation={`$${pricing.privateTransferPerGB}/GB (no free tier)`}
            formula={[
              `API reports transfer in bytes.`,
              `Convert to GB: ${privateTransfer.toLocaleString()} bytes ÷ 1,000,000,000 = ${(privateTransfer / 1e9).toFixed(2)} GB.`,
              `Cost: ${(privateTransfer / 1e9).toFixed(2)} GB × $${pricing.privateTransferPerGB}/GB`,
            ].join("\n")}
            cost={formatCurrency(privTransferCost)}
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Understanding the Numbers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Byte-hours:</strong> Storage metrics are
            reported as byte-hours (bytes_stored x hours). For example, 2 GB stored for a full
            day = 2e9 x 24 = 48e9 byte-hours. To get the average size (what Console shows),
            divide by total hours in the period. To get the billing unit (GB-months), divide by 744 then by 1e9.
          </p>
          <p>
            <strong className="text-foreground">Branch-hours:</strong> Every hour, the system
            counts child branches per project. Despite the name,{" "}
            <code className="text-foreground">extra_branches_month</code> includes{" "}
            <em>all</em> child branches, not just extras. Subtract the plan allowance per
            project before summing. Divide by 744 for branch-months.
          </p>
          <p>
            <strong className="text-foreground">744:</strong> Fixed billing period constant
            (31 x 24 hours), used by Neon regardless of actual month length.
            Shorter months cost slightly less since fewer hours accumulate.
          </p>
          <p>
            <strong className="text-foreground">Granularity:</strong> Use{" "}
            <code className="text-foreground">granularity=hourly</code> for exact billing
            match (allowance subtracted per hour). Daily is a close approximation.
            The API limits hourly to the last 168 hours, daily to 60 days.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Full API Example</CardTitle>
        </CardHeader>
        <CardContent>
          <CurlBlock
            cmd={`curl "https://console.neon.tech/api/v2/consumption_history/v2/projects?\\
org_id=\${ORG_ID}&from=${billingPeriod.from}&to=${billingPeriod.to}&\\
granularity=${billingPeriod.granularity}&metrics=compute_unit_seconds,\\
root_branch_bytes_month,child_branch_bytes_month,\\
instant_restore_bytes_month,snapshot_storage_bytes_month,extra_branches_month,\\
public_network_transfer_bytes${planConfig.hasPrivateNetworking ? ",private_network_transfer_bytes" : ""}&limit=100" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
          />
        </CardContent>
      </Card>
      <ConsumptionFieldCard
        title="Quick Project Snapshot"
        endpoint="GET /projects/{project_id}"
        description="Returns current billing period consumption for a single project. A quick alternative to querying the full consumption history, useful for spot-checking one project without date range parameters."
        fields={[
          {
            name: "compute_time_seconds",
            description: "Total CPU-seconds this billing period. Divide by 3,600 for CU-hours.",
          },
          {
            name: "active_time_seconds",
            description: "Wall-clock time endpoints were running. Helps distinguish idle from active compute.",
          },
          {
            name: "data_storage_bytes_hour",
            description: "Byte-hours of storage for the period. Divide by hours elapsed for average size, or by 744 × 1e9 for GB-months.",
          },
          {
            name: "data_transfer_bytes",
            description: "Egress traffic this period in bytes. Divide by 1,000,000,000 for GB.",
          },
          {
            name: "consumption_period_start",
            description: "Billing cycle start. All consumption fields reset here.",
          },
        ]}
        curl={`curl "https://console.neon.tech/api/v2/projects/\${PROJECT_ID}" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
      />
    </div>
  )
}
