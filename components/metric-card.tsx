import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type MetricCardProps = {
  title: string
  value: string | null
  subtitle?: string | null
  cost?: string | null
  loading?: boolean
}

export function MetricCard({ title, value, subtitle, cost, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1 h-4 w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value ?? "—"}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {cost !== undefined && (
          <p className="text-xs text-muted-foreground">
            {cost ? `~${cost}` : "—"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
