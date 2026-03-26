"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export function BillingPeriodPicker({
  months,
  currentMonth,
}: {
  months: { value: string; label: string }[]
  currentMonth: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("month", value)
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  return (
    <div className="flex items-center gap-2">
      {months.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            m.value === currentMonth
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
