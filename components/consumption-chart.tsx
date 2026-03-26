"use client"

import { useState, useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
} from "recharts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Plan } from "@/lib/plans"
import { METRICS, type MetricKey } from "@/lib/metrics"

type DataPoint = { date: string } & Record<MetricKey, number>

// Derived from the METRICS registry — label, color, and unit stay in sync automatically.
const METRIC_CONFIG = Object.fromEntries(
  METRICS.map((m) => [m.dailyKey, { label: m.label, color: m.color, unit: m.chartUnit }]),
) as Record<MetricKey, { label: string; color: string; unit: string }>

type ConsumptionChartProps = {
  data: DataPoint[]
  plan: Plan
}

function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatUsageValue(value: number, unit: string): string {
  if (unit === "byte-hours-daily") {
    const avgBytes = value / 24
    const gb = avgBytes / 1e9
    return `${gb.toFixed(2)} GB`
  }
  if (unit === "bytes") {
    const gb = value / 1e9
    return `${gb.toFixed(2)} GB`
  }
  if (unit === "CU-seconds") {
    const hours = value / 3600
    return `${hours.toFixed(2)} CU-hr`
  }
  if (unit === "branch-hours") {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} branch-hr`
  }
  return value.toFixed(1)
}

function formatCostValue(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(3)}`
  return `$${value.toFixed(4)}`
}

function compactDollar(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  if (abs >= 1) return `$${value.toFixed(0)}`
  if (abs >= 0.01) return `$${value.toFixed(2)}`
  if (abs === 0) return "$0"
  return `$${value.toFixed(3)}`
}

function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  if (abs >= 1) return value.toFixed(0)
  if (abs === 0) return "0"
  return value.toPrecision(2)
}

// Derived from the METRICS registry — new metrics appear in cost view automatically.
function toCostPoint(d: DataPoint, plan: Plan): DataPoint {
  const result = { date: d.date } as DataPoint
  for (const metric of METRICS) {
    result[metric.dailyKey] = d[metric.dailyKey] * metric.toCostMultiplier(plan)
  }
  return result
}

function getPeaks(data: DataPoint[], selected: MetricKey[]): Record<MetricKey, number> {
  const peaks = {} as Record<MetricKey, number>
  for (const key of selected) {
    let max = 0
    for (const d of data) {
      if (d[key] > max) max = d[key]
    }
    peaks[key] = max
  }
  return peaks
}

function shouldNormalizeUsage(data: DataPoint[], selected: MetricKey[]): boolean {
  if (selected.length <= 1) return false
  const units = new Set(selected.map((k) => METRIC_CONFIG[k].unit))
  if (units.size > 1) return true
  const peaks = getPeaks(data, selected)
  const vals = selected.map((k) => peaks[k]).filter((v) => v > 0)
  if (vals.length < 2) return false
  return Math.max(...vals) / Math.min(...vals) > 10
}

function normalizeData(
  data: DataPoint[],
  selected: MetricKey[],
): DataPoint[] {
  const peaks = getPeaks(data, selected)
  return data.map((d) => {
    const point = { ...d }
    for (const key of selected) {
      const peak = peaks[key]
      point[key] = peak > 0 ? (d[key] / peak) * 100 : 0
    }
    return point
  })
}

export function ConsumptionChart({ data, plan }: ConsumptionChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    "compute",
    "storageRoot",
  ])
  const [mode, setMode] = useState<"usage" | "cost">("usage")

  const isCost = mode === "cost"

  const costData = useMemo(
    () => data.map((d) => toCostPoint(d, plan)),
    [data, plan],
  )

  const isNormalized = !isCost && shouldNormalizeUsage(data, selectedMetrics)

  const { chartData, rawLookup } = useMemo(() => {
    if (isCost) {
      return { chartData: costData, rawLookup: null }
    }
    if (isNormalized) {
      const normalized = normalizeData(data, selectedMetrics)
      const lookup = new Map<string, DataPoint>()
      for (const d of data) lookup.set(d.date, d)
      return { chartData: normalized, rawLookup: lookup }
    }
    return { chartData: data, rawLookup: null }
  }, [data, costData, selectedMetrics, isNormalized, isCost])

  const toggleMetric = (metric: MetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric],
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-base">Consumption Over Time</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "usage" | "cost")}>
              <TabsList>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="cost">Cost ($)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {(Object.entries(METRIC_CONFIG) as [MetricKey, typeof METRIC_CONFIG[MetricKey]][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => toggleMetric(key)}
                aria-pressed={selectedMetrics.includes(key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedMetrics.includes(key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {config.label}
              </button>
            ),
          )}
        </div>
        {isNormalized && (
          <p className="text-xs text-muted-foreground pt-1">
            Metrics use different scales — each is shown as % of its peak so trends are comparable. Hover for actual values.
          </p>
        )}
        {isCost && selectedMetrics.length > 1 && (
          <p className="text-xs text-muted-foreground pt-1">
            Stacked cost breakdown — each band shows a metric&apos;s contribution to total daily cost.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No consumption data available for the selected time range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                className="text-xs"
              />
              <YAxis
                className="text-xs"
                width={70}
                domain={isNormalized ? [0, 100] : undefined}
                tickFormatter={
                  isNormalized
                    ? (v) => `${Number(v).toFixed(0)}%`
                    : isCost
                      ? (v) => compactDollar(Number(v))
                      : (v) => compactNumber(Number(v))
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const raw = rawLookup?.get(String(label))

                  let total: number | null = null
                  if (isCost && selectedMetrics.length > 1) {
                    total = 0
                    for (const entry of payload) {
                      total += Number(entry.value) || 0
                    }
                  }

                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <p className="mb-1.5 text-xs font-medium">
                        {formatDateTick(String(label))}
                      </p>
                      {payload.map((entry) => {
                        const key = entry.dataKey as MetricKey
                        const config = METRIC_CONFIG[key]
                        if (!config) return null

                        let display: string
                        let suffix = ""

                        if (isCost) {
                          display = formatCostValue(Number(entry.value))
                        } else if (isNormalized && raw) {
                          display = formatUsageValue(raw[key], config.unit)
                          suffix = ` (${Number(entry.value).toFixed(0)}%)`
                        } else {
                          display = formatUsageValue(Number(entry.value), config.unit)
                        }

                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{config.label}:</span>
                            <span className="font-mono font-medium">{display}</span>
                            {suffix && (
                              <span className="text-muted-foreground">{suffix}</span>
                            )}
                          </div>
                        )
                      })}
                      {total !== null && (
                        <div className="mt-1 border-t pt-1 text-xs font-medium">
                          Total: <span className="font-mono">{formatCostValue(total)}</span>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              <Legend />
              {selectedMetrics.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={METRIC_CONFIG[key].label}
                  stroke={METRIC_CONFIG[key].color}
                  fill={METRIC_CONFIG[key].color}
                  fillOpacity={isCost ? 0.6 : 0.1}
                  stackId={isCost ? "cost" : undefined}
                />
              ))}
              {chartData.length > 14 && (
                <Brush dataKey="date" height={30} stroke="var(--chart-1)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
