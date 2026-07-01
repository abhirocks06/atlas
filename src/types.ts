export interface Notification {
  date: string
  transmittal: string | null
  country: string | null
  system: string | null
  costUSD: number | null
  contractor: string | null
  contractorLocation: string | null
  description: string | null
  sourceUrl: string | null
  /** ISO date when this record was added to Atlas; drives the "new" badge for 3 days. */
  addedAt?: string
}
