import { cn } from "@/lib/utils"

export function UsageBar({
  label,
  used,
  limit,
  formatUsed,
  formatLimit,
}: {
  label: string
  used: number
  limit: number
  formatUsed: string
  formatLimit: string
}) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0
  const percent = Math.round(ratio * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{percent}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${formatUsed} of ${formatLimit}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            ratio >= 0.9
              ? "bg-red-500"
              : ratio >= 0.75
                ? "bg-yellow-500"
                : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatUsed} / {formatLimit}
      </p>
    </div>
  )
}
