import {
  parseAsString,
  parseAsStringEnum,
  parseAsArrayOf,
  createSearchParamsCache,
} from "nuqs/server"

export type TimePresetKey = "7d" | "30d" | "60d" | "12m"
export type Granularity = "hourly" | "daily" | "monthly"

export const TIME_PRESETS: Record<
  TimePresetKey,
  { label: string; granularity: Granularity }
> = {
  "7d": { label: "Last 7 days", granularity: "hourly" },
  "30d": { label: "Last 30 days", granularity: "daily" },
  "60d": { label: "Last 60 days", granularity: "daily" },
  "12m": { label: "Last 12 months", granularity: "monthly" },
}

export const searchParamsParsers = {
  org: parseAsString,
  range: parseAsStringEnum<TimePresetKey>(["7d", "30d", "60d", "12m"]).withDefault("30d"),
  projects: parseAsArrayOf(parseAsString, ","),
}

export const searchParamsCache = createSearchParamsCache(searchParamsParsers)
