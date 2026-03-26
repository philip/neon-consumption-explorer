export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarNav } from "@/components/sidebar-nav"
import { OrgSwitcher } from "@/components/org-switcher"
import { TimeRangePicker } from "@/components/time-range-picker"
import { getOrganizations } from "@/lib/api"
import { isDemoMode } from "@/lib/demo"
import { DemoBanner } from "@/components/demo-banner"
import { Separator } from "@/components/ui/separator"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Neon Consumption Explorer",
    template: "%s | Neon Consumption Explorer",
  },
  description: "Explore and understand your Neon usage and costs",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const orgsResult = await getOrganizations()
  const organizations = orgsResult.data?.organizations ?? []

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NuqsAdapter>
          <TooltipProvider>
            <div className="flex min-h-screen">
              <aside className="hidden w-64 shrink-0 border-r bg-card p-4 md:block">
                <div className="flex flex-col gap-4">
                  <h2 className="px-3 text-lg font-semibold tracking-tight">
                    Neon Consumption
                  </h2>
                  <OrgSwitcher organizations={organizations} />
                  <Separator />
                  <SidebarNav />
                </div>
              </aside>
              <main className="flex-1 overflow-auto">
                {isDemoMode() && <DemoBanner />}
                <div className="flex items-center justify-between border-b px-6 py-3">
                  <div />
                  <TimeRangePicker />
                </div>
                <div className="p-6">{children}</div>
              </main>
            </div>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
