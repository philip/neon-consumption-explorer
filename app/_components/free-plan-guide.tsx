import { getProjects, getProjectBranches, getProjectSnapshots } from "@/lib/api"
import { formatBytes, formatBillingPeriod } from "@/lib/format"
import { BYTES_PER_GB } from "@/lib/pricing"
import { getPlan } from "@/lib/plans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsageBar } from "@/components/usage-bar"
import { CurlBlock } from "@/components/curl-block"
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

  let maxComputeSeconds = 0
  let totalTransferBytes = 0
  for (const s of snapshots) {
    maxComputeSeconds = Math.max(maxComputeSeconds, s.computeTimeSeconds)
    totalTransferBytes += s.dataTransferBytes
  }

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageBar
              label="Compute Time (busiest project)"
              used={maxComputeSeconds / 3600}
              limit={computeHoursLimit}
              formatUsed={`${(maxComputeSeconds / 3600).toFixed(1)} hrs`}
              formatLimit={`${computeHoursLimit} hrs`}
            />
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

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          API Endpoints (curl examples)
        </summary>
        <Card className="mt-2">
          <CardContent className="space-y-3 pt-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Get project detail</strong>{" "}
                <code>active_time_seconds</code>, <code>compute_time_seconds</code>,{" "}
                <code>data_transfer_bytes</code>
              </p>
              <CurlBlock
                cmd={`curl "https://console.neon.tech/api/v2/projects/\${PROJECT_ID}" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
              />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">List branches</strong>{" "}
                <code>logical_size</code> per branch
              </p>
              <CurlBlock
                cmd={`curl "https://console.neon.tech/api/v2/projects/\${PROJECT_ID}/branches" \\
  -H "Authorization: Bearer \${NEON_API_KEY}"`}
              />
            </div>
          </CardContent>
        </Card>
      </details>
    </div>
  )
}
