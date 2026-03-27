import { api } from "@/lib/api/client"
import { METRIC_API_NAMES } from "@/lib/metrics"

export type ApiResult<T> = {
  data: T | null
  error: string | null
}

const API_REVALIDATE_SECONDS = 300
const REVALIDATE = { next: { revalidate: API_REVALIDATE_SECONDS } }

function formatError(error: unknown, response?: { status: number }): string {
  const status = response?.status ? `${response.status}: ` : ""
  if (error && typeof error === "object" && "message" in error) {
    return `${status}${String((error as { message: unknown }).message)}`
  }
  return `${status}Unknown error`
}

// ---------------------------------------------------------------------------
// Shared domain types
// ---------------------------------------------------------------------------

export type Organization = {
  id: string
  name: string
  plan?: string
}

export type Project = {
  id: string
  name: string
  compute_time_seconds?: number
  active_time?: number
  active_time_seconds?: number
  data_transfer_bytes?: number
  written_data_bytes?: number
  data_storage_bytes_hour?: number
  consumption_period_start?: string
  consumption_period_end?: string
}

export type Branch = {
  id: string
  name: string
  logical_size?: number
  current_state?: string
}

export type ConsumptionProject = {
  project_id: string
  periods: {
    consumption: {
      timeframe_start: string
      metrics: { metric_name: string; value: number }[]
    }[]
    period_plan?: string
  }[]
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** List organizations for the authenticated user */
export async function getOrganizations(): Promise<
  ApiResult<{ organizations: Organization[] }>
> {
  try {
    const { data, error, response } = await api.GET("/users/me/organizations", {
      ...REVALIDATE,
    })
    if (error) return { data: null, error: formatError(error, response) }
    return {
      data: data as { organizations: Organization[] },
      error: null,
    }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

// Derived from the METRICS registry in lib/metrics.ts — add new metrics there.
const CONSUMPTION_METRICS = METRIC_API_NAMES

type ConsumptionHistoryParams = {
  orgId: string
  from: string
  to: string
  granularity: "hourly" | "daily" | "monthly"
  projectIds?: string[]
  limit?: number
}

/** Fetch project-level consumption history with pagination */
export async function getConsumptionHistory(
  params: ConsumptionHistoryParams,
): Promise<ApiResult<{ projects: ConsumptionProject[] }>> {
  try {
    const allProjects: ConsumptionProject[] = []
    let cursor: string | undefined
    let prevCursor: string | undefined
    const MAX_PAGES = 50

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error, response } = await api.GET(
        "/consumption_history/v2/projects",
        {
          params: {
            query: {
              org_id: params.orgId,
              from: params.from,
              to: params.to,
              granularity: params.granularity,
              metrics: [...CONSUMPTION_METRICS],
              limit: params.limit ?? 100,
              ...(params.projectIds?.length
                ? { project_ids: params.projectIds }
                : {}),
              ...(cursor ? { cursor } : {}),
            },
          },
          ...REVALIDATE,
        },
      )

      if (error) {
        return { data: null, error: formatError(error, response) }
      }

      const responseData = data as {
        projects?: ConsumptionProject[]
        pagination?: { cursor?: string }
      }
      allProjects.push(...(responseData.projects ?? []))
      prevCursor = cursor
      cursor = responseData.pagination?.cursor
      if (!cursor || cursor === prevCursor) break
    }

    return { data: { projects: allProjects }, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

/**
 * Fetch V2 consumption for only currently-active projects.
 * Avoids paginating through deleted projects by fetching project IDs first.
 */
export async function getActiveProjectsConsumption(params: {
  orgId: string
  from: string
  to: string
  granularity: "hourly" | "daily" | "monthly"
}): Promise<ApiResult<{ projects: ConsumptionProject[] }>> {
  const projectsResult = await getProjects({ orgId: params.orgId })
  if (projectsResult.error) {
    return { data: null, error: projectsResult.error }
  }
  const projectIds = (projectsResult.data?.projects ?? []).map((p) => p.id)

  if (projectIds.length === 0) {
    return { data: { projects: [] }, error: null }
  }

  return getConsumptionHistory({ ...params, projectIds })
}

/** List projects (with current-period consumption snapshot) */
export async function getProjects(params: {
  orgId: string
}): Promise<ApiResult<{ projects: Project[] }>> {
  try {
    const allProjects: Project[] = []
    let cursor: string | undefined
    let prevCursor: string | undefined
    const MAX_PAGES = 50

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error, response } = await api.GET("/projects", {
        params: {
          query: {
            org_id: params.orgId,
            limit: 400,
            ...(cursor ? { cursor } : {}),
          },
        },
        ...REVALIDATE,
      })
      if (error) return { data: null, error: formatError(error, response) }
      const responseData = data as {
        projects?: Project[]
        pagination?: { cursor?: string }
      }
      allProjects.push(...(responseData.projects ?? []))
      prevCursor = cursor
      cursor = responseData.pagination?.cursor
      if (!cursor || cursor === prevCursor) break
    }

    return { data: { projects: allProjects }, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

/** Get single project with current consumption and quota */
export async function getProject(
  projectId: string,
): Promise<ApiResult<{ project: Project }>> {
  try {
    const { data, error, response } = await api.GET(
      "/projects/{project_id}",
      {
        params: { path: { project_id: projectId } },
        ...REVALIDATE,
      },
    )
    if (error) return { data: null, error: formatError(error, response) }
    return { data: data as { project: Project }, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

/** List branches for a project */
export async function getProjectBranches(
  projectId: string,
): Promise<ApiResult<{ branches: Branch[] }>> {
  try {
    const { data, error, response } = await api.GET(
      "/projects/{project_id}/branches",
      {
        params: { path: { project_id: projectId } },
        ...REVALIDATE,
      },
    )
    if (error) return { data: null, error: formatError(error, response) }
    return { data: data as { branches: Branch[] }, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

export type ProjectSnapshot = {
  projectId: string
  projectName: string
  computeTimeSeconds: number
  activeTimeSeconds: number
  dataStorageBytesHour: number
  dataTransferBytes: number
  writtenDataBytes: number
  consumptionPeriodStart: string
  consumptionPeriodEnd: string
}

/**
 * Fetch current-period consumption snapshots for all projects.
 * Calls GET /projects/{project_id} in parallel for each project.
 * Works on ALL plans (including Free).
 */
export async function getProjectSnapshots(
  orgId: string,
): Promise<ApiResult<ProjectSnapshot[]>> {
  const projectsResult = await getProjects({ orgId })
  if (projectsResult.error) {
    return { data: null, error: projectsResult.error }
  }

  const projectsList = projectsResult.data?.projects ?? []

  if (projectsList.length === 0) {
    return { data: [], error: null }
  }

  const BATCH_SIZE = 10
  const settled: PromiseSettledResult<ProjectSnapshot | null>[] = []
  for (let i = 0; i < projectsList.length; i += BATCH_SIZE) {
    const batch = projectsList.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (p) => {
        const result = await getProject(p.id)
        if (result.error || !result.data?.project) {
          return null
        }
        const proj = result.data.project
        return {
          projectId: p.id,
          projectName: proj.name ?? p.name ?? p.id,
          computeTimeSeconds: proj.compute_time_seconds ?? 0,
          activeTimeSeconds: proj.active_time_seconds ?? 0,
          dataStorageBytesHour: proj.data_storage_bytes_hour ?? 0,
          dataTransferBytes: proj.data_transfer_bytes ?? 0,
          writtenDataBytes: proj.written_data_bytes ?? 0,
          consumptionPeriodStart: proj.consumption_period_start ?? "",
          consumptionPeriodEnd: proj.consumption_period_end ?? "",
        } satisfies ProjectSnapshot
      }),
    )
    settled.push(...batchResults)
  }

  const snapshots = settled
    .filter(
      (r): r is PromiseFulfilledResult<ProjectSnapshot | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((s): s is ProjectSnapshot => s !== null)

  return { data: snapshots, error: null }
}
