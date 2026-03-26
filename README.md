# Neon Consumption Explorer

Explore and understand your [Neon](https://neon.tech) usage and costs using the public API.

This tool fetches consumption data from the Neon API, breaks down every billable metric, shows cost formulas, and includes curl examples so you can reproduce every number yourself. This is not an official Neon application.

## Pages

- **Usage Guide** (`/`) — explains every metric with step-by-step cost formulas and curl examples. Works for free and paid plans.
- **Dashboard** (`/dashboard`) — aggregated metric cards and a time-series chart with usage/cost toggle.
- **Projects** (`/projects`) — per-project consumption table, sorted by estimated cost.
- **Project detail** (`/projects/[id]`) — single project with branch list, chart, and cost breakdown.

## Setup

### Prerequisites

- None for demo mode, a [Neon API key](https://neon.tech/docs/manage/api-keys) to use your data

### Install and run

```sh
git clone https://github.com/philip/neon-consumption-explorer.git
cd neon-consumption-explorer
npm install
npm run dev
```

To use real data, add your API key:

```sh
cp .env.example .env.local
# set NEON_API_KEY
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEON_API_KEY` | No | Your Neon API key. If omitted, the app runs in demo mode with mock org data. |
| `NEON_API_BASE_URL` | No | Override the API base URL (defaults to `https://console.neon.tech/api/v2`) |

### Demo mode

If `NEON_API_KEY` is not set, the app automatically runs with mock data. No signup or API key needed, just `npm install && npm run dev`.

The org switcher becomes a scenario picker with four pre-built scenarios:

| Scenario | Plan | Projects | ~Monthly spend |
|---|---|---|---|
| Free plan | free | 5 | $0 |
| Launch plan, ~$15/mo | launch | 3 | $15 |
| Launch plan, ~$150/mo | launch | 12 | $150 |
| Scale plan, ~$500/mo | scale | 25 | $500 |

All mock values are deterministic (seeded PRNG) and respect each plan's allowances and rates. The free scenario returns a 403 for the consumption history endpoint, matching real Neon behavior.

Scenarios are defined in `lib/demo.ts`. To add or tweak a scenario, edit the `DEMO_SCENARIOS` array.

### URL parameters

All pages accept these query string parameters:

| Parameter | Example | Description |
|---|---|---|
| `org` | `?org=demo-scale-heavy` | Select organization (or demo scenario) |
| `range` | `?range=7d` | Time range: `7d`, `30d`, `60d`, or `12m` (default: `30d`) |
| `projects` | `?projects=id1,id2` | Comma-separated project IDs to filter the chart |

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Components)
- [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [shadcn/ui](https://ui.shadcn.com) components
- [Recharts](https://recharts.org) for charts
- [TanStack Table](https://tanstack.com/table) for sortable, paginated tables
- [nuqs](https://nuqs.47ng.com) for URL state
- [date-fns](https://date-fns.org) for date calculations
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) + [openapi-typescript](https://openapi-ts.dev) for type-safe API calls

## API

This tool uses the [Neon API](https://api-docs.neon.tech/reference/getting-started-with-neon-api). Key endpoints:

- `GET /users/me/organizations` — list organizations
- `GET /consumption_history/v2/projects` — consumption history (paid plans)
- `GET /projects` — project list with current-period snapshots
- `GET /projects/{id}` — project detail
- `GET /projects/{id}/branches` — branch list

## Plan config

Plan pricing and allowances are centralized in `lib/plans.ts`. Update this file if pricing changes.

## Regenerating API types

The generated types in `lib/generated/public-api.d.ts` come from the Neon OpenAPI spec. To regenerate after an API update:

```sh
curl -o public-v2-full.gen.json https://neon.com/api_spec/release/v2.json
npm run generate-types
```
