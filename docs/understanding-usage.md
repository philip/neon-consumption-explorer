# Usage calculations

This guide helps you use the Neon API to fetch your consumption data, convert raw metrics into human-readable numbers, and understand how your bill is calculated. To monitor usage in the Neon Console instead, see [Monitor billing and usage](/docs/introduction/monitor-usage).

It applies to **Launch**, **Scale**, **Agent**, and **Enterprise** plans. Consumption history begins at the time you upgrade from the Free plan.

## Fetch your usage

The [consumption history endpoint](https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2) returns per-project, per-day (or per-hour, or per-month) usage for every billable metric.

```sh
curl "https://console.neon.tech/api/v2/consumption_history/v2/projects?\
org_id=${ORG_ID}&from=2026-03-01T00:00:00Z&to=2026-04-01T00:00:00Z&\
granularity=daily&metrics=compute_unit_seconds,root_branch_bytes_month,\
child_branch_bytes_month,instant_restore_bytes_month,snapshot_storage_bytes_month,\
extra_branches_month,public_network_transfer_bytes,private_network_transfer_bytes&limit=100" \
  -H "Authorization: Bearer ${NEON_API_KEY}"
```

Required parameters: `org_id`, `from`, `to`, `granularity`, `metrics`. Optional: `project_ids`, `limit`, `cursor`. For the complete API reference including pagination, polling, rate limits, and error handling, see [Querying consumption metrics](/docs/guides/consumption-metrics).

## The eight billable metrics

| API metric name | What it measures | Raw unit | Billing unit |
|---|---|---|---|
| `compute_unit_seconds` | CPU time weighted by compute size | CU-seconds | CU-hours |
| `root_branch_bytes_month` | Storage on the default branch | byte-hours | GB-months |
| `child_branch_bytes_month` | Storage on child branches (delta from parent) | byte-hours | GB-months |
| `instant_restore_bytes_month` | Instant restore (point-in-time recovery / PITR) history | byte-hours | GB-months |
| `snapshot_storage_bytes_month` | Storage held by manual and scheduled branch snapshots | byte-hours | GB-months |
| `public_network_transfer_bytes` | Egress over the public network | bytes | GB |
| `private_network_transfer_bytes` | Egress over private networking (Scale+) | bytes | GB |
| `extra_branches_month` | All child branches per hour (subtract plan allowance before billing) | branch-hours | branch-months |

A Compute Unit (CU) corresponds to 1 CPU with 4 GB RAM. A 2 CU endpoint accumulates 2 CU-seconds for every wall-clock second it runs.

## Converting raw values to readable numbers

Neon uses decimal gigabytes (1 GB = 10^9 bytes), not gibibytes, and a fixed billing period of **744 hours** (31 x 24), regardless of actual month length.

| From | To | Formula |
|---|---|---|
| CU-seconds | CU-hours | `value / 3600` |
| byte-hours | GB-months (billing unit) | `value / 744 / 1000000000` |
| byte-hours | average GB (what Console shows) | `value / hours_in_period / 1000000000` |
| bytes | GB | `value / 1000000000` |
| branch-hours | branch-months | `value / 744` |

For "average GB," `hours_in_period` is the number of hours between your `from` and `to` timestamps.

## Calculating your cost

Sum each metric's cost to get the total. Rates differ by plan (see [Plans](/docs/introduction/plans) for current pricing):

| Metric | Formula | Launch | Scale |
|---|---|---|---|
| Compute | CU-hours x rate | $0.106/CU-hr | $0.222/CU-hr |
| Root storage | GB-months x rate | $0.35/GB-mo | $0.35/GB-mo |
| Child storage | GB-months x rate | $0.35/GB-mo | $0.35/GB-mo |
| Instant restore | GB-months x rate | $0.20/GB-mo | $0.20/GB-mo |
| Snapshots | GB-months x rate | $0.09/GB-mo | $0.09/GB-mo |
| Public transfer | max(0, org_total_GB - 100) x rate | $0.10/GB | $0.10/GB |
| Private transfer | GB x rate | n/a | $0.01/GB |
| Extra branches | branch-months x rate | $1.50/mo | $1.50/mo |

Agent and Enterprise rates match Scale. Enterprise plans may include custom negotiated pricing.

### Example: compute

If the API returns `"value": 500000` for `compute_unit_seconds` on the Scale plan:

1. Convert: 500000 / 3600 = 138.89 CU-hours
2. Cost: 138.89 x $0.222 = **$30.83**

### Example: storage

If the API returns `"value": 2500000000000` for `root_branch_bytes_month`:

1. Convert: 2500000000000 / 744 / 1000000000 = 3.36 GB-months
2. Cost: 3.36 x $0.35 = **$1.18**

### Example: snapshots

If the API returns `"value": 7500000000000` for `snapshot_storage_bytes_month`:

1. Convert: 7500000000000 / 744 / 1000000000 = 10.08 GB-months
2. Cost: 10.08 x $0.09 = **$0.91**

## Key concepts

### The 744 constant

Neon defines a billing month as exactly 744 hours (31 x 24). This constant is used for all byte-hour and branch-hour conversions, regardless of how many days the calendar month has. Shorter months (28 or 30 days) accumulate fewer hours, so they cost slightly less.

### Byte-hours

Storage metrics are reported as byte-hours: bytes stored multiplied by hours held. For example, 2 GB stored for a full day produces 2000000000 x 24 = 48000000000 byte-hours. Over a full 31-day month that's 48000000000 x 31 = 1488000000000 byte-hours, which converts to 1488000000000 / 744 / 1000000000 = 2.0 GB-months, costing 2.0 x $0.35 = $0.70. The raw numbers look large, but they convert to modest GB-months values.

### Branch-hours and the allowance

The `extra_branches_month` metric counts **all** child branches, not only the ones beyond your allowance. Each plan includes a set number of branches per project, and the root branch is always included, so the free child allowance is `branches_per_project - 1`. That's 9 on Launch and 24 on Scale. To calculate billable branch-hours:

1. For each project and each time bucket (day or hour), compute the free allowance: `(branches_per_project - 1) x hours_in_bucket`.
2. Subtract: `billable = max(0, reported_branch_hours - free_allowance)`.
3. Sum across all projects and days, then divide by 744 for branch-months.

**Example:** A project has 12 child branches on Launch, queried with daily granularity. The API returns `"value": 288` for `extra_branches_month` for one day:

1. Free allowance for that day: (10 - 1) x 24 = 216 branch-hours
2. Billable: max(0, 288 - 216) = 72 branch-hours
3. Convert: 72 / 744 = 0.097 branch-months
4. Cost: 0.097 x $1.50 = **$0.15**

Repeat for each day in the billing period and sum the billable branch-hours across all projects before dividing by 744.

### Snapshots

> **Note**: Snapshot billing began on 2026-05-01. The consumption history may report `snapshot_storage_bytes_month` for earlier dates (during the beta period); those values are not charged.

The `snapshot_storage_bytes_month` metric reports byte-hours for **manual** snapshots and **scheduled** (recurring) snapshots. Manual snapshots and the **first** scheduled snapshot of a branch are billed on full logical size. **Subsequent** scheduled snapshots are billed incrementally — only the diff since the previous scheduled snapshot. The consumption metric folds both billing modes together, so summing `snapshot_storage_bytes_month` across days, dividing by 744 and 1000000000, and multiplying by the snapshot rate gives the total snapshot cost.

To inspect individual snapshots, the [List project snapshots](https://api-docs.neon.tech/reference/listsnapshots) endpoint returns a `full_size` or `diff_size` (bytes) per snapshot, depending on which billing mode applies. See [Backup & restore](/docs/guides/backup-restore#snapshot-size-fields-in-api-responses) for details on when each field is present.

### Public transfer allowance

On paid plans, the 100 GB free allowance applies **org-wide**, not per project. Sum public transfer across all projects before subtracting the allowance:

```
billable GB = max(0, total_org_GB - 100)
cost = billable_GB x $0.10
```

### Granularity and precision

Using `granularity=hourly` gives the most precise match to Neon's internal billing calculations. Branch allowances are evaluated per hour: each hour's child branch count is compared to the plan allowance independently. Coarser granularity averages out within-bucket fluctuations, so daily or monthly queries may slightly underestimate billable branch-hours compared to the actual invoice. Daily granularity is a close approximation that's accurate enough for most use cases. Monthly granularity covers up to 12 months and is useful for trend analysis, but is the least precise for allowance calculations and bill reconciliation.

## Quick project snapshot

You can also get the current billing period's totals for a single project without specifying date ranges:

```sh
curl "https://console.neon.tech/api/v2/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${NEON_API_KEY}"
```

The response includes:

| Field | What it tells you |
|---|---|
| `compute_time_seconds` | Total CPU-seconds this billing period. Divide by 3600 for CU-hours. |
| `active_time_seconds` | Wall-clock seconds endpoints were running. Divide `compute_time_seconds` by this value to get your average compute size in CUs (weighted average if the compute was resized during the period). |
| `data_storage_bytes_hour` | Byte-hours of storage. Divide by hours elapsed for average size, or by 744 x 1000000000 for GB-months. |
| `data_transfer_bytes` | Egress traffic in bytes. Divide by 1000000000 for GB. |
| `consumption_period_start` | Start of the billing cycle. All consumption fields reset here. |

These field names differ from the consumption history metrics. `compute_time_seconds` corresponds to `compute_unit_seconds`; `data_storage_bytes_hour` combines root, child, and instant restore storage; `data_transfer_bytes` combines public and private transfer. This endpoint is useful for spot-checking a single project without querying the full consumption history.

## Understanding your bill

Neon sends a weekly usage email that includes per-metric costs. You can also check charges to date on the [Billing page](/docs/introduction/monitor-usage#billing-page) in the Console. Those costs are calculated using the same formulas described above: raw API values converted to billing units, multiplied by the plan rate, with allowances subtracted where applicable.

To reconcile the numbers yourself:

1. Fetch consumption history for the billing month (`from` = month start, `to` = month end or current date).
2. Sum each metric across all projects.
3. Convert to billing units using the formulas above.
4. Apply allowances (100 GB public transfer, branch allowance per project).
5. Multiply by your plan's rates.

The result should closely match the costs in your weekly email. Small differences can occur due to:

- **Granularity**: the billing system uses hourly precision. If you query with `daily` granularity, branch allowance rounding can introduce minor variance.
- **Timing**: your query's `to` timestamp may differ slightly from the snapshot used for the email.
- **Rounding**: display rounding in the email versus full-precision calculation.

For the most accurate match, use `granularity=hourly` and align your `from`/`to` with your `consumption_period_start` (available in the [project snapshot](#quick-project-snapshot) response) and the email's generation time.

## Free plan

The V2 consumption history endpoint is not available on the Free plan. You can still track your usage through two endpoints.

### Project snapshot

Use `GET /projects/{project_id}` (see [Quick project snapshot](#quick-project-snapshot) above) to check compute time, data transfer, and storage for the current billing period.

### Branch storage

The Free plan caps storage per project based on `logical_size` across branches. Use `GET /projects/{project_id}/branches` to check each branch's size:

```sh
curl "https://console.neon.tech/api/v2/projects/${PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}"
```

Each branch in the response includes a `logical_size` field (bytes). Sum across branches to get total project storage.

### Free plan limits

See the [Neon Free plan docs](/docs/introduction/plans#free-plan) for current limits. Exceeding them suspends compute or blocks creation. There are no costs on the Free plan.

---

To reduce your costs across compute, storage, branches, and data transfer, see [Cost optimization](/docs/introduction/cost-optimization). For network transfer specifically, see [Reduce network transfer costs](/docs/introduction/network-transfer).
