import { type ProjectSnapshot } from "@/lib/api"
import {
  formatBytes,
  formatCUHours,
  formatActiveTime,
  formatBillingPeriod,
  formatStorageFromByteHours,
  formatGBMonths,
} from "@/lib/format"
import { MetricCard } from "@/components/metric-card"
import { Card, CardContent } from "@/components/ui/card"

function computeSnapshotHoursInPeriod(snapshots: ProjectSnapshot[]): number {
  const start = snapshots[0]?.consumptionPeriodStart
  const end = snapshots[0]?.consumptionPeriodEnd
  if (!start || !end) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, ms / (1000 * 60 * 60))
}

export function SnapshotOverview({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  let totalCompute = 0
  let totalActiveTime = 0
  let totalStorageBH = 0
  let totalTransfer = 0

  for (const s of snapshots) {
    totalCompute += s.computeTimeSeconds
    totalActiveTime += s.activeTimeSeconds ?? 0
    totalStorageBH += s.dataStorageBytesHour
    totalTransfer += s.dataTransferBytes
  }

  const hoursInPeriod = computeSnapshotHoursInPeriod(snapshots)
  const periodStart = snapshots[0]?.consumptionPeriodStart ?? ""
  const periodEnd = snapshots[0]?.consumptionPeriodEnd ?? ""
  const periodLabel = periodStart && periodEnd
    ? formatBillingPeriod(periodStart, periodEnd)
    : "current billing period"

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-muted bg-muted/30">
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground">
            Showing current billing period data ({periodLabel}). Upgrade to a paid plan for historical usage charts and detailed metric breakdowns.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Compute"
          value={formatCUHours(totalCompute)}
          subtitle="Current billing period"
        />
        <MetricCard
          title="Storage"
          value={formatStorageFromByteHours(totalStorageBH, hoursInPeriod)}
          subtitle={totalStorageBH > 0 ? formatGBMonths(totalStorageBH) : undefined}
        />
        <MetricCard
          title="Data Transfer"
          value={formatBytes(totalTransfer)}
          subtitle="Current billing period"
        />
        <MetricCard
          title="Active Time"
          value={formatActiveTime(totalActiveTime)}
          subtitle="Wall-clock time endpoints were active"
        />
      </div>
    </div>
  )
}
