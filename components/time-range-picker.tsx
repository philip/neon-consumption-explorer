"use client"

import { useQueryState } from "nuqs"
import { usePathname } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TIME_PRESETS, type TimePresetKey } from "@/lib/search-params"

export function TimeRangePicker() {
  const [range, setRange] = useQueryState("range", {
    defaultValue: "30d",
    shallow: false,
  })
  const pathname = usePathname()

  if (pathname === "/") return null

  return (
    <Select value={range} onValueChange={setRange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(TIME_PRESETS) as [TimePresetKey, { label: string }][]).map(
          ([key, { label }]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  )
}
