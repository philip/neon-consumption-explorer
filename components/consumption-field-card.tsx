import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurlBlock } from "@/components/curl-block"

type FieldInfo = {
  name: string
  description: string
}

type ConsumptionFieldCardProps = {
  title: string
  endpoint: string
  description: string
  fields: FieldInfo[]
  curl: string
}

export function ConsumptionFieldCard({
  title,
  endpoint,
  description,
  fields,
  curl,
}: ConsumptionFieldCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="font-mono text-xs text-muted-foreground">{endpoint}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{description}</p>
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.name} className="grid gap-1 sm:grid-cols-[180px_1fr]">
              <code className="text-xs font-semibold">{f.name}</code>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            curl example
          </summary>
          <div className="mt-2">
            <CurlBlock cmd={curl} />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
