import { Badge } from "@/components/ui/badge"
import { getPlan, type Plan } from "@/lib/plans"

export function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {getPlan(plan).label} plan
    </Badge>
  )
}
