import { computeTimeRange } from "@/lib/time-range"
import { getConsumptionHistory } from "@/lib/api"
import { formatCurrency, formatRate, formatAvgCU } from "@/lib/format"
import { detectPlanFromConsumption, calculatePublicTransferCostRaw } from "@/lib/pricing"
import { getPlan } from "@/lib/plans"
import { METRICS } from "@/lib/metrics"
import { aggregateProjectMetrics } from "@/lib/consumption"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionError } from "@/components/section-error"

export async function CostBreakdown({
  projectId,
  orgId,
  range,
  activeTimeSeconds,
}: {
  projectId: string
  orgId: string
  range: "7d" | "30d" | "60d" | "12m"
  activeTimeSeconds?: number
}) {
  const timeRange = computeTimeRange(range)
  const result = await getConsumptionHistory({
    orgId,
    from: timeRange.from,
    to: timeRange.to,
    granularity: timeRange.granularity,
    projectIds: [projectId],
  })

  if (result.error) return <SectionError title="Cost Breakdown" error={result.error} />

  const projects = result.data?.projects ?? []
  const plan = detectPlanFromConsumption(projects)
  const project = projects[0]
  if (!project) return null

  const { totals } = aggregateProjectMetrics(project, plan)
  const planConfig = getPlan(plan)
  const { rates } = planConfig
  const avgCU = activeTimeSeconds != null
    ? formatAvgCU(totals.compute, activeTimeSeconds)
    : null
  const rows = METRICS.map((metric) => {
    const isPublicTransfer = metric.dailyKey === "publicTransfer"
    return {
      label: metric.label,
      value: metric.formatValue(totals[metric.dailyKey]),
      subtitle: metric.dailyKey === "compute" ? avgCU : null,
      // Public transfer uses raw cost (no allowance deduction) because the
      // allowance is org-wide. Proportional attribution
      // (projectGB / orgTotalGB × billableGB × rate) would be more accurate
      // but requires fetching all projects' consumption on this page.
      cost: isPublicTransfer
        ? calculatePublicTransferCostRaw(totals[metric.dailyKey], plan)
        : metric.calculateCost(totals[metric.dailyKey], plan),
      rate: formatRate(rates[metric.rateKey], metric.rateUnit),
      note: isPublicTransfer && planConfig.allowances.publicTransferGB > 0
        ? `before ${planConfig.allowances.publicTransferGB} GB org-wide allowance`
        : null,
    }
  })

  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Estimated Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1 font-medium">Metric</th>
                <th className="pb-1 text-right font-medium">Usage</th>
                <th className="pb-1 text-right font-medium">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-1.5">
                    {row.label}
                    {row.rate && (
                      <span className="ml-1.5 text-xs text-muted-foreground">({row.rate})</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs">
                    {row.value ?? "—"}
                    {row.subtitle && (
                      <span className="ml-1.5 text-muted-foreground">({row.subtitle})</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatCurrency(row.cost)}
                    {row.note && (
                      <div className="text-[10px] font-normal text-muted-foreground">{row.note}</div>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="pt-2">Total</td>
                <td />
                <td className="pt-2 text-right font-mono">{formatCurrency(totalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
