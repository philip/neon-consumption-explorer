import type { Metadata } from "next"
import { Suspense } from "react"
import { searchParamsCache } from "@/lib/search-params"
import { resolveOrg } from "@/lib/org"
import { getProject } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectHeader } from "@/app/projects/_components/project-header"
import { ProjectTimeSeries } from "@/app/projects/_components/project-time-series"
import { CostBreakdown } from "@/app/projects/_components/cost-breakdown"
import { BranchList } from "@/app/projects/_components/branch-list"

type Params = Promise<{ projectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { projectId } = await params
  const result = await getProject(projectId)
  const name = result.data?.project?.name ?? projectId
  return {
    title: `Project: ${name}`,
    description: `Consumption details for project ${name}`,
  }
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { projectId } = await params
  const sp = searchParamsCache.parse(await searchParams)
  const range = sp.range
  const { orgId } = await resolveOrg(sp.org)

  const qs = new URLSearchParams()
  if (orgId) qs.set("org", orgId)
  if (range && range !== "30d") qs.set("range", range)
  const queryString = qs.toString()

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <ProjectHeader projectId={projectId} queryString={queryString} />
      </Suspense>

      {orgId && (
        <Suspense
          fallback={
            <Card>
              <CardContent className="py-4">
                <Skeleton className="h-[350px] w-full" />
              </CardContent>
            </Card>
          }
        >
          <ProjectTimeSeries projectId={projectId} orgId={orgId} range={range} />
        </Suspense>
      )}

      {orgId && (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <CostBreakdown projectId={projectId} orgId={orgId} range={range} />
        </Suspense>
      )}

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <BranchList projectId={projectId} />
      </Suspense>
    </div>
  )
}
