import { getProject, getProjectBranches } from "@/lib/api"
import { formatBytes, formatBillingPeriod, formatAvgCU } from "@/lib/format"
import { BYTES_PER_GB } from "@/lib/pricing"
import { getPlan } from "@/lib/plans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsageBar } from "@/components/usage-bar"
import { SectionError } from "@/components/section-error"

export async function FreeConsumptionSummary({
  projectId,
}: {
  projectId: string
}) {
  const [projectResult, branchesResult] = await Promise.all([
    getProject(projectId),
    getProjectBranches(projectId),
  ])

  if (projectResult.error) {
    return <SectionError title="Consumption" error={projectResult.error} />
  }

  const project = projectResult.data?.project
  if (!project) return null

  const allowances = getPlan("free").allowances
  const computeHoursLimit = allowances.computeCUHoursPerProject!
  const storagePerProjectBytes = allowances.storageGBPerProject! * BYTES_PER_GB

  const computeSeconds = project.compute_time_seconds ?? 0
  const activeSeconds = project.active_time_seconds ?? 0
  const transferBytes = project.data_transfer_bytes ?? 0
  const avgCU = formatAvgCU(computeSeconds, activeSeconds)
  const periodStart = project.consumption_period_start
  const periodEnd = project.consumption_period_end

  const branches = branchesResult.data?.branches ?? []
  const totalStorage = branches.reduce((sum, b) => sum + (b.logical_size ?? 0), 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Current Billing Period
        </CardTitle>
        {periodStart && periodEnd && (
          <p className="text-xs text-muted-foreground">
            {formatBillingPeriod(periodStart, periodEnd)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <UsageBar
              label="Compute Time"
              used={computeSeconds / 3600}
              limit={computeHoursLimit}
              formatUsed={`${(computeSeconds / 3600).toFixed(1)} hrs`}
              formatLimit={`${computeHoursLimit} hrs`}
            />
            {avgCU && (
              <p className="text-xs text-muted-foreground">{avgCU}</p>
            )}
          </div>
          <UsageBar
            label="Storage"
            used={totalStorage}
            limit={storagePerProjectBytes}
            formatUsed={formatBytes(totalStorage)}
            formatLimit={formatBytes(storagePerProjectBytes)}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Data Transfer</p>
            <p className="text-sm font-mono">
              {formatBytes(transferBytes)}
              <span className="ml-1 text-muted-foreground">
                of {allowances.publicTransferGB} GB shared limit
              </span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Branches</p>
            <p className="text-sm font-mono">
              {branches.length} / {allowances.branchesPerProject}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
