"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { formatCUHours, formatBytes, formatCurrency } from "@/lib/format"
import { ArrowUpDown } from "lucide-react"
import { DataTable } from "@/components/data-table"

export type ProjectRow = {
  projectId: string
  projectName: string
  compute: number
  storageTotal: number
  publicTransfer: number
  privateTransfer: number
  extraBranches: number
  estimatedCost: number
}

function buildColumns(queryString: string): ColumnDef<ProjectRow, unknown>[] {
  const qs = queryString ? `?${queryString}` : ""
  return [
    {
      accessorKey: "projectName",
      header: "Project",
      cell: ({ row }) => (
        <Link
          href={`/projects/${row.original.projectId}${qs}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.projectName}
        </Link>
      ),
    },
    {
      accessorKey: "compute",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Compute
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatCUHours(row.original.compute),
    },
    {
      accessorKey: "storageTotal",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Storage
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatBytes(row.original.storageTotal),
    },
    {
      accessorKey: "publicTransfer",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Public Transfer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatBytes(row.original.publicTransfer),
    },
    {
      accessorKey: "privateTransfer",
      header: "Private Transfer",
      cell: ({ row }) => formatBytes(row.original.privateTransfer),
    },
    {
      accessorKey: "extraBranches",
      header: "Extra Branch-Hours",
      cell: ({ row }) =>
        row.original.extraBranches.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "estimatedCost",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Est. Cost
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatCurrency(row.original.estimatedCost),
    },
  ]
}

export function ProjectTable({ data }: { data: ProjectRow[] }) {
  const searchParams = useSearchParams()
  const columns = useMemo(() => buildColumns(searchParams.toString()), [searchParams])

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No projects found."
      initialSorting={[{ id: "estimatedCost", desc: true }]}
    />
  )
}
