# Decision Log

Noteworthy decisions made during development and the reasoning behind them.

---

## 1. Do not display "Written Data" metric

**Date:** 2026-03-05

**Context:** The Neon API tracks `written_data_bytes` per project -- the total WAL (Write-Ahead Log) data written across all branches during the billing period. We considered adding a "Written Data" column to the free and paid project tables.

**Decision:** Do not display `written_data_bytes` in any table.

**Reasons:**

- Not a billed metric on any plan (no cost rate exists for it).
- No published default limit on any plan. It exists as a configurable `ProjectQuota` field, but Neon's pricing page does not list a standard cap.
- Not actionable for users -- "you wrote 500 MB of WAL" doesn't suggest a clear optimization path, unlike compute hours or storage size.
- Only available from the project detail endpoint (`GET /projects/{project_id}`), not the list endpoint (`GET /projects`). Fetching it for all projects requires N individual API calls. Free plans allow up to 100 projects, making this expensive for marginal value.
- Often confused with the restore window's "1 GB of data changes" limit, which is a different concept (rolling WAL retention window for PITR, not cumulative writes).

**Note on the list endpoint:** The `GET /projects` list endpoint (`ProjectListItem` schema) returns a limited set of consumption fields: `active_time` and `cpu_used_sec` (deprecated). Fields like `compute_time_seconds`, `active_time_seconds`, `data_transfer_bytes`, `written_data_bytes`, and `consumption_period_start/end` are only available from the detail endpoint (`GET /projects/{project_id}`). We use `getProjectSnapshots` (which calls the detail endpoint per project) for free plan data because the list endpoint lacks the needed fields.

---
