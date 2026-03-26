import { isDemoMode } from "@/lib/demo"
import * as real from "./queries"
import * as mock from "../mock/queries"

export type {
  ApiResult,
  Organization,
  Project,
  Branch,
  ConsumptionProject,
  ProjectSnapshot,
} from "./queries"

const q = isDemoMode() ? mock : real

export const getOrganizations = q.getOrganizations
export const getConsumptionHistory = q.getConsumptionHistory
export const getActiveProjectsConsumption = q.getActiveProjectsConsumption
export const getProjects = q.getProjects
export const getProject = q.getProject
export const getProjectBranches = q.getProjectBranches
export const getProjectSnapshots = q.getProjectSnapshots
