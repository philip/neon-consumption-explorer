import { getProjectBranches } from "@/lib/api"
import { formatBytes } from "@/lib/format"
import { SectionError } from "@/components/section-error"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export async function BranchList({ projectId }: { projectId: string }) {
  const branchesResult = await getProjectBranches(projectId)
  if (branchesResult.error) {
    return <SectionError title="Branches" error={branchesResult.error} />
  }

  const branches = branchesResult.data?.branches ?? []

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Branches ({branches.length})</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Logical Size</TableHead>
              <TableHead className="text-right">State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length > 0 ? (
              branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {b.logical_size != null ? formatBytes(b.logical_size) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {b.current_state ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-16 text-center">
                  No branches found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
