import type { Metadata } from "next"
import { Suspense } from "react"
import { searchParamsCache } from "@/lib/search-params"
import { computeTimeRange } from "@/lib/time-range"
import {
  getConsumptionHistory,
  getProjects,
  getProjectBranches,
  getProjectSnapshots,
  type ProjectSnapshot,
} from "@/lib/api"
import { resolveOrg } from "@/lib/org"
import { byteHoursToAvgBytes, detectPlanFromConsumption, BYTES_PER_GB } from "@/lib/pricing"
import { getPlan, type Plan } from "@/lib/plans"
import { METRICS } from "@/lib/metrics"
import { aggregateProjectMetrics, type ProjectConsumption } from "@/lib/consumption"
import { ProjectTable, type ProjectRow } from "@/components/project-table"
import {
  FreePlanProjectTable,
  type FreePlanProjectRow,
} from "@/components/free-plan-project-table"
import { SectionError } from "@/components/section-error"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Projects",
  description: "Per-project consumption breakdown",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function computeSnapshotHours(snapshot: ProjectSnapshot): number {
  if (!snapshot.consumptionPeriodStart || !snapshot.consumptionPeriodEnd) return 0
  const ms = new Date(snapshot.consumptionPeriodEnd).getTime() -
    new Date(snapshot.consumptionPeriodStart).getTime()
  return Math.max(0, ms / (1000 * 60 * 60))
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

async function ProjectsContent({
  orgId,
  range,
}: {
  orgId: string
  range: "7d" | "30d" | "60d" | "12m"
}) {
  const timeRange = computeTimeRange(range)

  const [consumptionResult, projectsResult] = await Promise.all([
    getConsumptionHistory({
      orgId,
      from: timeRange.from,
      to: timeRange.to,
      granularity: timeRange.granularity,
    }),
    getProjects({ orgId }),
  ])

  if (consumptionResult.error && projectsResult.error) {
    return (
      <SectionError
        title="Projects"
        error={consumptionResult.error}
      />
    )
  }

  const projectNameMap = new Map<string, string>()
  const projectActiveTimeMap = new Map<string, number>()
  const projectsList = projectsResult.data?.projects ?? []
  for (const p of projectsList) {
    projectNameMap.set(p.id, p.name)
    projectActiveTimeMap.set(p.id, p.active_time ?? 0)
  }

  const consumptionProjects = consumptionResult.data?.projects ?? []
  const plan: Plan = consumptionProjects.length > 0
    ? detectPlanFromConsumption(consumptionProjects)
    : "free"

  const consumptionMap = new Map<string, ProjectConsumption>()
  for (const cp of consumptionProjects) {
    consumptionMap.set(cp.project_id, cp)
  }

  const snapshotMap = new Map<string, ProjectSnapshot>()
  if (consumptionResult.error) {
    const snapshotResult = await getProjectSnapshots(orgId)
    if (snapshotResult.data) {
      for (const s of snapshotResult.data) {
        snapshotMap.set(s.projectId, s)
      }
    }
  }

  if (plan === "free") {
    const allowances = getPlan("free").allowances
    const computeHoursLimit = allowances.computeCUHoursPerProject!
    const storagePerProjectBytes = allowances.storageGBPerProject! * BYTES_PER_GB

    const [snapshotResult, ...branchResults] = await Promise.all([
      getProjectSnapshots(orgId),
      ...projectsList.map(async (p) => {
        const result = await getProjectBranches(p.id)
        return { projectId: p.id, branches: result.data?.branches ?? [] }
      }),
    ])

    const snapshotByProject = new Map<string, ProjectSnapshot>()
    for (const s of snapshotResult.data ?? []) {
      snapshotByProject.set(s.projectId, s)
    }

    const branchMap = new Map<string, { logical_size?: number }[]>()
    for (const r of branchResults) {
      branchMap.set(r.projectId, r.branches)
    }

    const freeRows: FreePlanProjectRow[] = projectsList.map((p) => {
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
      <FreePlanProjectTable
        data={freeRows}
        limits={{
          computeHoursPerProject: computeHoursLimit,
          storageBytesPerProject: storagePerProjectBytes,
          branchesPerProject: allowances.branchesPerProject,
        }}
      />
    )
  }

  const allProjectIds = new Set([
    ...projectsList.map((p) => p.id),
    ...consumptionProjects.map((p) => p.project_id),
  ])

  const rows: ProjectRow[] = [...allProjectIds].map((projectId) => {
    const row: ProjectRow = {
      projectId,
      projectName: projectNameMap.get(projectId) ?? projectId,
      compute: 0,
      activeTimeSeconds: projectActiveTimeMap.get(projectId) ?? 0,
      storageTotal: 0,
      publicTransfer: 0,
      privateTransfer: 0,
      extraBranches: 0,
      estimatedCost: 0,
    }

    const project = consumptionMap.get(projectId)
    if (project) {
      const { totals, billableTotals, dayCount } = aggregateProjectMetrics(project, plan)
      row.compute = totals.compute
      row.publicTransfer = totals.publicTransfer
      row.privateTransfer = totals.privateTransfer
      row.storageTotal = byteHoursToAvgBytes(
        totals.storageRoot + totals.storageChild + totals.storageHistory,
        dayCount * 24,
      )
      row.extraBranches = totals.extraBranches
      row.estimatedCost = METRICS.reduce(
        (sum, metric) => sum + metric.calculateCost(billableTotals[metric.dailyKey], plan),
        0,
      )
      return row
    }

    const snapshot = snapshotMap.get(projectId)
    if (snapshot) {
      row.compute = snapshot.computeTimeSeconds
      const hoursInPeriod = computeSnapshotHours(snapshot)
      row.storageTotal = byteHoursToAvgBytes(snapshot.dataStorageBytesHour, hoursInPeriod)
      row.publicTransfer = snapshot.dataTransferBytes
    }

    return row
  })

  return (
    <div className="flex flex-col gap-4">
      {consumptionResult.error && (
        <p className="text-sm text-muted-foreground">
          Historical consumption data is unavailable for this plan. Showing current billing period snapshots.
          {snapshotMap.size === 0 && " No snapshot data could be loaded."}
        </p>
      )}
      <ProjectTable data={rows} />
    </div>
  )
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = searchParamsCache.parse(await searchParams)
  const range = params.range

  const { orgId, orgName } = await resolveOrg(params.org)

  if (!orgId) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No organization found. Please set your NEON_API_KEY in .env
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Per-project consumption for <span className="font-medium text-foreground">{orgName}</span>
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ProjectsContent orgId={orgId} range={range} />
      </Suspense>
    </div>
  )
}
