import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurlBlock } from "@/components/curl-block"

type MetricExplainerProps = {
  title: string
  apiField: string
  rawValue: string
  interpretation: string
  formula: string
  cost: string
  curl?: string
}

export function MetricExplainer({
  title,
  apiField,
  rawValue,
  interpretation,
  formula,
  cost,
  curl,
}: MetricExplainerProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="font-mono text-xs text-muted-foreground">{apiField}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Raw API Value</p>
            <p className="font-mono">{rawValue}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">What It Means</p>
            <p>{interpretation}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Cost Formula</p>
            <p className="whitespace-pre-line font-mono text-xs">{formula}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estimated Cost</p>
            <p className="text-lg font-bold">{cost}</p>
          </div>
        </div>
        {curl && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              curl example
            </summary>
            <div className="mt-2">
              <CurlBlock cmd={curl} />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
