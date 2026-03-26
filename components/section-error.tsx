import { Card, CardContent } from "@/components/ui/card"

type SectionErrorProps = {
  title: string
  error: string
}

export function SectionError({ title, error }: SectionErrorProps) {
  const is403 = error.includes("403")

  let message: string
  if (is403) {
    message = "This data requires a paid Neon plan."
  } else {
    message = `Data unavailable: ${error}`
  }

  return (
    <Card className="border-muted">
      <CardContent className="flex flex-col gap-2 py-4">
        <span className="text-sm font-medium">{title}</span>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
