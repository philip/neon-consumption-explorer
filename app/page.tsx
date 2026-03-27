import type { Metadata } from "next"
import { Suspense } from "react"
import { searchParamsCache } from "@/lib/search-params"
import { getActiveProjectsConsumption, getProjects } from "@/lib/api"
import { resolveOrg } from "@/lib/org"
import { detectPlanFromConsumption } from "@/lib/pricing"
import type { Plan } from "@/lib/plans"
import { parseBillingMonth, getAvailableMonths, billingPeriodToParam } from "@/lib/billing-period"
import { Skeleton } from "@/components/ui/skeleton"
import { BillingPeriodPicker } from "@/components/billing-period-picker"
import { PlanBadge } from "@/components/plan-badge"
import { PaidPlanGuide } from "@/app/_components/paid-plan-guide"
import { FreePlanGuide } from "@/app/_components/free-plan-guide"

export const metadata: Metadata = {
  title: "Usage Guide",
  description: "Understand your Neon consumption metrics and costs",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

async function GuideContent({
  orgId,
  month,
  availableMonths,
  currentMonthValue,
}: {
  orgId: string
  month: string | null
  availableMonths: { value: string; label: string }[]
  currentMonthValue: string
}) {
  const billingPeriod = parseBillingMonth(month)
  const consumptionResult = await getActiveProjectsConsumption({
    orgId,
    from: billingPeriod.from,
    to: billingPeriod.to,
    granularity: billingPeriod.granularity,
  })

  const consumptionProjects = consumptionResult.data?.projects ?? []
  const isPaid = consumptionResult.error === null && consumptionProjects.length > 0

  const plan: Plan = isPaid ? detectPlanFromConsumption(consumptionProjects) : "free"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PlanBadge plan={plan} />
        <span className="text-muted-foreground">—</span>
        <p className="text-muted-foreground">
          {isPaid ? (
            <><a href="https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">V2 consumption history</a>: every billable metric, cost formulas, and curl examples.</>
          ) : (
            <><a href="https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">V2 consumption history</a> requires a paid plan. Showing available Free plan usage data.</>
          )}
        </p>
      </div>

      {isPaid ? (
        <>
          <BillingPeriodPicker months={availableMonths} currentMonth={currentMonthValue} />
          <PaidPlanGuide
            projects={consumptionProjects}
            plan={plan}
            billingPeriod={billingPeriod}
            totalActiveSeconds={billingPeriod.isCurrentMonth ? await getTotalActiveSeconds(orgId) : null}
          />
        </>
      ) : (
        <FreePlanGuide orgId={orgId} />
      )}
    </div>
  )
}

async function getTotalActiveSeconds(orgId: string): Promise<number> {
  const result = await getProjects({ orgId })
  return (result.data?.projects ?? []).reduce((sum, p) => sum + (p.active_time ?? 0), 0)
}

export default async function GuidePage({ searchParams }: { searchParams: SearchParams }) {
  const params = searchParamsCache.parse(await searchParams)
  const rawParams = await searchParams
  const month = typeof rawParams.month === "string" ? rawParams.month : null

  const { orgId, orgName } = await resolveOrg(params.org)

  if (!orgId) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No organization found. Please set your NEON_API_KEY in .env
      </div>
    )
  }
  const billingPeriod = parseBillingMonth(month)
  const availableMonths = getAvailableMonths(6)
  const currentMonthValue = billingPeriodToParam(billingPeriod)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage Guide</h1>
        <p className="text-sm text-muted-foreground">
          Understanding your consumption data for{" "}
          <span className="font-medium text-foreground">{orgName}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything on this page uses the{" "}
          <a href="https://api-docs.neon.tech/reference/getting-started-with-neon-api" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
            Neon API
          </a>. You can reproduce every number with curl and your API key.
        </p>
      </div>

      <Suspense
        key={currentMonthValue + orgId}
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <GuideContent
          orgId={orgId}
          month={month}
          availableMonths={availableMonths}
          currentMonthValue={currentMonthValue}
        />
      </Suspense>
    </div>
  )
}
