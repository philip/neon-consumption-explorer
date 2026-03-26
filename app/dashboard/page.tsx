import type { Metadata } from "next"
import { Suspense } from "react"
import { searchParamsCache } from "@/lib/search-params"
import { computeTimeRange } from "@/lib/time-range"
import {
  getConsumptionHistory,
  getProjectSnapshots,
} from "@/lib/api"
import { resolveOrg } from "@/lib/org"
import {
  formatCurrency,
  formatBranchMonths,
  formatBranchHours,
} from "@/lib/format"
import {
  calculateExtraBranchesCost,
  detectPlanFromConsumption,
} from "@/lib/pricing"
import { METRICS } from "@/lib/metrics"
import { aggregateConsumption } from "@/lib/consumption"
import { MetricCard } from "@/components/metric-card"
import { ConsumptionChart } from "@/components/consumption-chart"
import { SectionError } from "@/components/section-error"
import { SnapshotOverview } from "@/components/snapshot-overview"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Aggregated consumption metrics and cost overview",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function MetricCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: METRICS.length }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="mt-1 h-4 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function OverviewMetrics({
  orgId,
  range,
}: {
  orgId: string
  range: "7d" | "30d" | "60d" | "12m"
}) {
  const timeRange = computeTimeRange(range)
  const result = await getConsumptionHistory({
    orgId,
    from: timeRange.from,
    to: timeRange.to,
    granularity: timeRange.granularity,
  })

  if (result.error) {
    const snapshotResult = await getProjectSnapshots(orgId)
    if (snapshotResult.data && snapshotResult.data.length > 0) {
      return <SnapshotOverview snapshots={snapshotResult.data} />
    }
    return <SectionError title="Consumption Metrics" error={result.error} />
  }

  const projects = result.data?.projects ?? []
  const plan = detectPlanFromConsumption(projects)
  const { daily, totals, dayCount } = aggregateConsumption(projects, plan)
  const hoursInPeriod = dayCount * 24
  const totalCost = METRICS.reduce(
    (sum, metric) => sum + metric.calculateCost(totals[metric.totalsKey], plan),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2 lg:col-span-4 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              For the selected period ({range}) on {plan} plan
            </p>
          </CardContent>
        </Card>

        {METRICS.filter((m) => !m.customAggregation).map((metric) => (
          <MetricCard
            key={metric.dailyKey}
            title={metric.label}
            value={metric.formatDisplayValue(totals[metric.totalsKey], hoursInPeriod)}
            subtitle={metric.formatSubtitle?.(totals[metric.totalsKey], hoursInPeriod)}
            cost={formatCurrency(metric.calculateCost(totals[metric.totalsKey], plan))}
          />
        ))}
        {/* Extra Branches kept explicit: subtitle needs totals.total_branch_hours
            which is outside the per-metric totals. */}
        <MetricCard
          title="Extra Branches"
          value={formatBranchMonths(totals.billable_extra_branch_hours)}
          subtitle={formatBranchHours(totals.total_branch_hours) + " total (all child branches)"}
          cost={formatCurrency(calculateExtraBranchesCost(totals.billable_extra_branch_hours, plan))}
        />
      </div>

      <ConsumptionChart data={daily} plan={plan} />
    </div>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = searchParamsCache.parse(await searchParams)
  const range = params.range

  const { orgId, orgName } = await resolveOrg(params.org)

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">No organization found. Please set your NEON_API_KEY in .env</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Consumption overview for <span className="font-medium text-foreground">{orgName}</span>
        </p>
      </div>

      <Suspense fallback={<MetricCardsSkeleton />}>
        <OverviewMetrics orgId={orgId} range={range} />
      </Suspense>

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            Estimates use published list prices and may not reflect negotiated
            Enterprise pricing. Costs are approximate and may differ from the final invoice.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
