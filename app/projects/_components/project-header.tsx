import Link from "next/link"
import { getProject } from "@/lib/api"
import { SectionError } from "@/components/section-error"
import { ArrowLeft } from "lucide-react"

export async function ProjectHeader({
  projectId,
  queryString,
}: {
  projectId: string
  queryString: string
}) {
  const result = await getProject(projectId)
  if (result.error) {
    return <SectionError title="Project" error={result.error} />
  }

  const project = result.data?.project
  const name = project?.name ?? projectId
  const quotaResetAt = project?.consumption_period_end

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/projects${queryString ? `?${queryString}` : ""}`}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Back to projects"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {quotaResetAt
            ? `Billing period ends ${new Date(quotaResetAt).toLocaleDateString()}`
            : `Project ${projectId}`}
        </p>
      </div>
    </div>
  )
}
