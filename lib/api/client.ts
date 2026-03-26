import createClient from "openapi-fetch"
import type { paths } from "@/lib/generated/public-api"

if (
  typeof window === "undefined" &&
  process.env.NEON_API_KEY &&
  !process.env.NEON_API_KEY.startsWith("napi_")
) {
  console.warn(
    "[neon] NEON_API_KEY does not look like a valid Neon API key (expected 'napi_' prefix).",
  )
}

export const api = createClient<paths>({
  baseUrl: process.env.NEON_API_BASE_URL ?? "https://console.neon.tech/api/v2",
  headers: {
    get Authorization() {
      return `Bearer ${process.env.NEON_API_KEY ?? ""}`
    },
  },
})
