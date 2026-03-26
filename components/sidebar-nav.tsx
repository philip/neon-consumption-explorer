"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BookOpen, LayoutDashboard, FolderKanban } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Usage Guide", icon: BookOpen },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
]

export function SidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={qs ? `${item.href}?${qs}` : item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
