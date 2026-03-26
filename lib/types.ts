export type ConsumptionMetrics = {
  compute_unit_seconds: number
  root_branch_byte_hours: number
  child_branch_byte_hours: number
  instant_restore_byte_hours: number
  public_network_transfer_bytes: number
  private_network_transfer_bytes: number
  /** Raw branch-hours before allowance deduction (all child branches). */
  total_branch_hours: number
  /** Billable branch-hours after per-project allowance deduction. */
  billable_extra_branch_hours: number
}
