import { getProjects, getProjectBranches, getProjectSnapshots } from "@/lib/api"
import { formatBytes, formatBillingPeriod, formatAvgCU } from "@/lib/format"
import { BYTES_PER_GB } from "@/lib/pricing"
import { getPlan } from "@/lib/plans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsageBar } from "@/components/usage-bar"
import { ConsumptionFieldCard } from "@/components/consumption-field-card"
import {
  FreePlanProjectTable,
  type FreePlanProjectRow,
} from "@/components/free-plan-project-table"

export async function FreePlanGuide({ orgId }: { orgId: string }) {
  const projectsResult = await getProjects({ orgId })

  if (projectsResult.error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-4">
          <p className="text-sm text-destructive">{projectsResult.error}</p>
        </CardContent>
      </Card>
    )
  }

  const projects = projectsResult.data?.projects ?? []

  const [snapshotResult, ...branchResults] = await Promise.all([
    getProjectSnapshots(orgId),
    ...projects.map(async (p) => {
      const result = await getProjectBranches(p.id)
      return { projectId: p.id, branches: result.data?.branches ?? [] }
    }),
  ])

  const snapshots = snapshotResult.data ?? []
  const snapshotByProject = new Map(snapshots.map((s) => [s.projectId, s]))

  const branchMap = new Map<
    string,
    { id: string; name: string; logical_size?: number }[]
  >()
  for (const r of branchResults) {
    branchMap.set(r.projectId, r.branches)
  }

  let billingPeriodLabel = ""
  if (snapshots.length > 0) {
    const { consumptionPeriodStart: start, consumptionPeriodEnd: end } = snapshots[0]
    if (start && end) {
      billingPeriodLabel = formatBillingPeriod(start, end)
    }
  }

  let totalComputeSeconds = 0
  let totalActiveSeconds = 0
  let totalTransferBytes = 0
  for (const s of snapshots) {
    totalComputeSeconds += s.computeTimeSeconds
    totalActiveSeconds += s.activeTimeSeconds
    totalTransferBytes += s.dataTransferBytes
  }
  const orgAvgCU = formatAvgCU(totalComputeSeconds, totalActiveSeconds)

  const allowances = getPlan("free").allowances
  const computeHoursLimit = allowances.computeCUHoursPerProject!
  const storagePerProjectBytes = allowances.storageGBPerProject! * BYTES_PER_GB
  const transferLimitBytes = allowances.publicTransferGB * BYTES_PER_GB

  const projectRows: FreePlanProjectRow[] = projects.map((p) => {
    const branches = branchMap.get(p.id) ?? []
    const storage = branches.reduce((sum, b) => sum + (b.logical_size ?? 0), 0)
    const snap = snapshotByProject.get(p.id)
    return {
      id: p.id,
      name: p.name,
      computeHours: (snap?.computeTimeSeconds ?? 0) / 3600,
      activeTimeSeconds: snap?.activeTimeSeconds ?? p.active_time ?? 0,
      storageBytes: storage,
      transferBytes: snap?.dataTransferBytes ?? 0,
      branchCount: branches.length,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Usage Summary (current billing period)
          </CardTitle>
          {billingPeriodLabel && (
            <p className="text-xs text-muted-foreground">{billingPeriodLabel}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Compute Time</p>
              <p className="text-sm font-mono">{(totalComputeSeconds / 3600).toFixed(1)} hrs</p>
              <p className="text-xs text-muted-foreground">
                {computeHoursLimit} hrs/project limit
              </p>
            </div>
            <UsageBar
              label="Data Transfer"
              used={totalTransferBytes}
              limit={transferLimitBytes}
              formatUsed={formatBytes(totalTransferBytes)}
              formatLimit={formatBytes(transferLimitBytes)}
            />
            <UsageBar
              label="Projects"
              used={projects.length}
              limit={allowances.projects}
              formatUsed={`${projects.length}`}
              formatLimit={`${allowances.projects}`}
            />
            {orgAvgCU && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Avg Compute Size</p>
                <p className="text-sm font-mono">{orgAvgCU}</p>
                <p className="text-xs text-muted-foreground">across all projects</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Storage and branches are limited per project ({formatBytes(storagePerProjectBytes)} and {allowances.branchesPerProject} branches each).
            See table below for per-project usage.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FreePlanProjectTable
            data={projectRows}
            limits={{
              computeHoursPerProject: computeHoursLimit,
              storageBytesPerProject: storagePerProjectBytes,
              branchesPerProject: allowances.branchesPerProject,
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Limits per project: {computeHoursLimit} compute hrs, {formatBytes(storagePerProjectBytes)} storage, {allowances.branchesPerProject} branches.
            Values near limits are highlighted.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Consumption API Fields</h2>

        <ConsumptionFieldCard
          title="Project Detail"
          endpoint="GET /projects/{project_id}"
          description="Returns current billing period consumption for a single project. All consumption fields reset at the start of each billing cycle."
          fields={[
            {
              name: "compute_time_seconds",
              description: `Total CPU-seconds this billing period. Divide by 3,600 for hours. Free plan limit: ${computeHoursLimit} hrs per project.`,
            },
            {
              name: "active_time_seconds",
              description: "Wall-clock time endpoints were running (always >= compute_time_seconds). Helps distinguish idle endpoints from actively computing ones.",
            },
            {
              name: "data_transfer_bytes",
              description: `Egress traffic this period. Divide by 1,000,000,000 for GB. Free plan limit: ${allowances.publicTransferGB} GB shared across all projects.`,
            },
            {
              name: "data_storage_bytes_hour",
              description: "Byte-hours of storage. Divide by hours elapsed in the period for average size in bytes. Note: the per-project storage cap applies to logical branch size, not this value.",
            },
            {
              name: "consumption_period_start",
              description: "Start of your billing cycle. All consumption fields reset here.",
            },
            {
              name: "consumption_period_end",
              description: "End of your billing cycle. Use with the start date to track how far into the period you are.",
            },
          ]}
          curl={`curl "https://console.neon.tech/api/v2/projects/\${PROJECT_ID}" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />

        <ConsumptionFieldCard
          title="List Branches"
          endpoint="GET /projects/{project_id}/branches"
          description={`Returns all branches for a project. The free plan allows up to ${allowances.branchesPerProject} branches per project.`}
          fields={[
            {
              name: "logical_size",
              description: `Actual data size of the branch in bytes. Sum across branches to get total project storage. Free plan limit: ${formatBytes(storagePerProjectBytes)} per project.`,
            },
            {
              name: "name",
              description: "Branch name. The default branch (usually 'main') is your primary data store.",
            },
          ]}
          curl={`curl "https://console.neon.tech/api/v2/projects/\${PROJECT_ID}/branches" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
        />
      </div>
    </div>
  )
}
