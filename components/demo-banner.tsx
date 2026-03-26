"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem("demo-banner-dismissed") === "true") {
      setDismissed(true)
    }
  }, [])

  if (dismissed) return null

  return (
    <div className="flex items-center justify-between gap-4 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-300">
      <p>
        You are viewing <strong>demo data</strong>. Set{" "}
        <code className="rounded bg-yellow-500/20 px-1 py-0.5 text-xs">NEON_API_KEY</code>{" "}
        in <code className="rounded bg-yellow-500/20 px-1 py-0.5 text-xs">.env.local</code>{" "}
        to use real data.
      </p>
      <button
        onClick={() => {
          setDismissed(true)
          sessionStorage.setItem("demo-banner-dismissed", "true")
        }}
        className="shrink-0 rounded p-0.5 hover:bg-yellow-500/20"
        aria-label="Dismiss demo banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
