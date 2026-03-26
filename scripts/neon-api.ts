/**
 * Generic Neon API query tool.
 *
 * Usage:
 *   npx tsx scripts/neon-api.ts <path> [--raw]
 *
 * Examples:
 *   npx tsx scripts/neon-api.ts /users/me/organizations
 *   npx tsx scripts/neon-api.ts "/projects?org_id=org-xxx&limit=5"
 *   npx tsx scripts/neon-api.ts /projects/my-project-id
 *
 * Reads NEON_API_KEY from .env.local. Prints JSON response to stdout.
 * With --raw, prints unformatted JSON (useful for piping to jq).
 */
import { config } from "dotenv"
config({ path: ".env.local" })

const API_KEY = process.env.NEON_API_KEY
const BASE = process.env.NEON_API_BASE_URL ?? "https://console.neon.tech/api/v2"

if (!API_KEY) {
  console.error("Error: NEON_API_KEY not found in .env.local")
  process.exit(1)
}

const args = process.argv.slice(2)
const raw = args.includes("--raw")
const path = args.find((a) => !a.startsWith("--"))

if (!path) {
  console.error("Usage: npx tsx scripts/neon-api.ts <path> [--raw]")
  console.error("  e.g. npx tsx scripts/neon-api.ts /users/me/organizations")
  process.exit(1)
}

async function main() {
  const url = path!.startsWith("http") ? path! : `${BASE}${path!.startsWith("/") ? "" : "/"}${path}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    console.error(`${res.status} ${res.statusText}: ${url}`)
    const body = await res.text()
    if (body) console.error(body)
    process.exit(1)
  }

  const data = await res.json()
  console.log(raw ? JSON.stringify(data) : JSON.stringify(data, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
