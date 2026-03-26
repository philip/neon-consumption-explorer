import { getOrganizations, type Organization } from "@/lib/api"

export type ResolvedOrg = {
  orgId: string
  orgName: string
  organizations: Organization[]
}

/**
 * Fetch organizations and resolve the active org from the URL param.
 * Falls back to the first org if none specified.
 */
export async function resolveOrg(orgParam: string | null | undefined): Promise<ResolvedOrg> {
  const orgsResult = await getOrganizations()
  const organizations = orgsResult.data?.organizations ?? []
  const validOrgId = orgParam && organizations.some((o) => o.id === orgParam)
    ? orgParam
    : organizations[0]?.id ?? ""
  const orgId = validOrgId
  const orgName = organizations.find((o) => o.id === orgId)?.name ?? orgId

  return { orgId, orgName, organizations }
}
