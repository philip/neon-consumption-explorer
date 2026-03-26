import { type ProjectSnapshot } from "@/lib/api"
import {
  formatBytes,
  formatCUHours,
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
  let totalStorageBH = 0
  let totalTransfer = 0
  let totalWritten = 0

  for (const s of snapshots) {
    totalCompute += s.computeTimeSeconds
    totalStorageBH += s.dataStorageBytesHour
    totalTransfer += s.dataTransferBytes
    totalWritten += s.writtenDataBytes
  }

  const hoursInPeriod = computeSnapshotHoursInPeriod(snapshots)
  const periodStart = snapshots[0]?.consumptionPeriodStart ?? ""
  const periodEnd = snapshots[0]?.consumptionPeriodEnd ?? ""
  const periodLabel = periodStart && periodEnd
    ? `${new Date(periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
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
          title="Written Data"
          value={formatBytes(totalWritten)}
          subtitle="Current billing period"
        />
      </div>
    </div>
  )
}
