import type {
  ApiResult,
  Organization,
  Project,
  Branch,
  ConsumptionProject,
  ProjectSnapshot,
} from "@/lib/api/queries"
import { getScenario } from "@/lib/demo"
import { getPlan } from "@/lib/plans"
import {
  generateOrganizations,
  generateProjects,
  generateConsumptionHistory,
  generateBranches,
  generateSnapshots,
} from "./generators"

export async function getOrganizations(): Promise<
  ApiResult<{ organizations: Organization[] }>
> {
  return { data: { organizations: generateOrganizations() }, error: null }
}

export async function getConsumptionHistory(params: {
  orgId: string
  from: string
  to: string
  granularity: "hourly" | "daily" | "monthly"
  projectIds?: string[]
  limit?: number
}): Promise<ApiResult<{ projects: ConsumptionProject[] }>> {
  const scenario = getScenario(params.orgId)

  if (!scenario.plan || scenario.plan === "free") {
    return { data: null, error: "403: This endpoint requires a paid plan." }
  }

  const projects = generateConsumptionHistory(scenario, params)
  return { data: { projects }, error: null }
}

export async function getActiveProjectsConsumption(params: {
  orgId: string
  from: string
  to: string
  granularity: "hourly" | "daily" | "monthly"
}): Promise<ApiResult<{ projects: ConsumptionProject[] }>> {
  return getConsumptionHistory(params)
}

export async function getProjects(params: {
  orgId: string
}): Promise<ApiResult<{ projects: Project[] }>> {
  const scenario = getScenario(params.orgId)
  const projects = generateProjects(scenario)
  return { data: { projects }, error: null }
}

export async function getProject(
  projectId: string,
): Promise<ApiResult<{ project: Project }>> {
  const orgId = extractOrgFromProjectId(projectId)
  const scenario = getScenario(orgId)
  const projects = generateProjects(scenario)
  const project = projects.find((p) => p.id === projectId)
  if (!project) {
    return { data: null, error: "404: Project not found" }
  }
  return { data: { project }, error: null }
}

export async function getProjectBranches(
  projectId: string,
): Promise<ApiResult<{ branches: Branch[] }>> {
  const orgId = extractOrgFromProjectId(projectId)
  const scenario = getScenario(orgId)
  const storageCap = (getPlan(scenario.plan).allowances.storageGBPerProject ?? 50) * 1e9
  const branches = generateBranches(projectId, storageCap)
  return { data: { branches }, error: null }
}

export async function getProjectSnapshots(
  orgId: string,
): Promise<ApiResult<ProjectSnapshot[]>> {
  const scenario = getScenario(orgId)
  return { data: generateSnapshots(scenario), error: null }
}

/**
 * Project IDs are formatted as `demo-proj-{orgId}-{index}`.
 * Extract the org ID to look up the right scenario.
 */
function extractOrgFromProjectId(projectId: string): string {
  const match = projectId.match(/^demo-proj-(.+)-\d{3}$/)
  return match?.[1] ?? "demo-free"
}
