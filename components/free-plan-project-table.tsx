"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { formatBytes, formatAvgCU } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ArrowUpDown } from "lucide-react"
import { DataTable } from "@/components/data-table"

export type FreePlanProjectRow = {
  id: string
  name: string
  computeHours: number
  activeTimeSeconds: number
  storageBytes: number
  branchCount: number
  transferBytes: number
}

type Limits = {
  computeHoursPerProject: number
  storageBytesPerProject: number
  branchesPerProject: number
}

function thresholdClass(used: number, limit: number): string {
  const ratio = limit > 0 ? used / limit : 0
  if (ratio >= 0.9) return "text-red-500 font-semibold"
  if (ratio >= 0.75) return "text-yellow-500"
  return ""
}

function sortableHeader(label: string) {
  return function SortableHeader({ column }: { column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => string | false } }) {
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {label}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    )
  }
}

function buildColumns(limits: Limits, queryString: string): ColumnDef<FreePlanProjectRow, unknown>[] {
  const qs = queryString ? `?${queryString}` : ""
  return [
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => (
        <Link
          href={`/projects/${row.original.id}${qs}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "computeHours",
      header: sortableHeader("Compute"),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-mono text-xs",
            thresholdClass(row.original.computeHours, limits.computeHoursPerProject),
          )}
        >
          {row.original.computeHours.toFixed(1)} hrs
        </span>
      ),
    },
    {
      id: "avgCU",
      header: "Avg CU",
      cell: ({ row }) => {
        const { computeHours, activeTimeSeconds } = row.original
        const label = formatAvgCU(computeHours * 3600, activeTimeSeconds)
        return <span className="font-mono text-xs">{label ?? "—"}</span>
      },
    },
    {
      accessorKey: "storageBytes",
      header: sortableHeader("Storage"),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-mono text-xs",
            thresholdClass(row.original.storageBytes, limits.storageBytesPerProject),
          )}
        >
          {formatBytes(row.original.storageBytes)}
        </span>
      ),
    },
    {
      accessorKey: "branchCount",
      header: sortableHeader("Branches"),
      cell: ({ row }) => (
        <span
          className={cn(
            "font-mono text-xs",
            thresholdClass(row.original.branchCount, limits.branchesPerProject),
          )}
        >
          {row.original.branchCount} / {limits.branchesPerProject}
        </span>
      ),
    },
    {
      accessorKey: "transferBytes",
      header: sortableHeader("Transfer"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {formatBytes(row.original.transferBytes)}
        </span>
      ),
    },
  ]
}

export function FreePlanProjectTable({
  data,
  limits,
}: {
  data: FreePlanProjectRow[]
  limits: Limits
}) {
  const searchParams = useSearchParams()
  const columns = useMemo(() => buildColumns(limits, searchParams.toString()), [limits, searchParams])

  return <DataTable columns={columns} data={data} emptyMessage="No projects found." />
}
