import { cn } from "@/lib/utils"

type UsageBarProps = {
  label: string
  used: number
  limit: number
  formatUsed: string
  formatLimit: string
}

export function UsageBar({ label, used, limit, formatUsed, formatLimit }: UsageBarProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isWarning = pct >= 75
  const isCritical = pct >= 90

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatUsed} / {formatLimit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${formatUsed} of ${formatLimit}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isCritical
              ? "bg-red-500"
              : isWarning
                ? "bg-yellow-500"
                : "bg-green-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-muted-foreground">
        {pct.toFixed(0)}% used
      </p>
    </div>
  )
}
