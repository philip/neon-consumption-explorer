"use client"

import { useCallback } from "react"
import { useQueryState } from "nuqs"
import { usePathname, useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Organization } from "@/lib/api"

type OrgSwitcherProps = {
  organizations: Organization[]
}

export function OrgSwitcher({ organizations }: OrgSwitcherProps) {
  const [orgId, setOrgId] = useQueryState("org", { shallow: false })
  const pathname = usePathname()
  const router = useRouter()

  const handleChange = useCallback(
    (newOrgId: string) => {
      const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname)
      if (isProjectDetail) {
        router.push(`/projects?org=${encodeURIComponent(newOrgId)}`)
      } else {
        setOrgId(newOrgId)
      }
    },
    [pathname, router, setOrgId],
  )

  if (organizations.length === 0) {
    return (
      <p className="px-3 text-sm text-muted-foreground">No organizations found</p>
    )
  }

  const currentOrg = orgId ?? organizations[0]?.id

  return (
    <Select value={currentOrg} onValueChange={handleChange}>
      <SelectTrigger className="w-full" aria-label="Select organization">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80" sideOffset={4}>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            <div className="flex flex-col gap-0.5 py-0.5">
              <span className="truncate">{org.name}</span>
              {org.plan && (
                <span className="text-xs text-muted-foreground capitalize">
                  {org.plan}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
