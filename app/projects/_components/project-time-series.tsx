import { computeTimeRange } from "@/lib/time-range"
import { getConsumptionHistory } from "@/lib/api"
import { detectPlanFromConsumption } from "@/lib/pricing"
import { aggregateConsumption, type ProjectConsumption } from "@/lib/consumption"
import { ConsumptionChart } from "@/components/consumption-chart"
import { SectionError } from "@/components/section-error"
import { Card, CardContent } from "@/components/ui/card"

export async function ProjectTimeSeries({
  projectId,
  orgId,
  range,
}: {
  projectId: string
  orgId: string
  range: "7d" | "30d" | "60d" | "12m"
}) {
  const timeRange = computeTimeRange(range)
  const result = await getConsumptionHistory({
    orgId,
    from: timeRange.from,
    to: timeRange.to,
    granularity: timeRange.granularity,
    projectIds: [projectId],
  })

  if (result.error) {
    if (result.error.includes("403")) {
      return (
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Historical usage charts require a paid plan. Current billing period data is shown above.
            </p>
          </CardContent>
        </Card>
      )
    }
    return <SectionError title="Consumption History" error={result.error} />
  }

  const projects = result.data?.projects ?? []
  const plan = detectPlanFromConsumption(projects)
  const { daily } = aggregateConsumption(projects, plan)

  return <ConsumptionChart data={daily} plan={plan} />
}
