export function formatCost(cost: number | null): string {
  if (cost === null) return 'Unknown'
  if (cost >= 1e9) return `$${(cost / 1e9).toFixed(2)}B`
  if (cost >= 1e6) return `$${(cost / 1e6).toFixed(0)}M`
  return `$${cost.toLocaleString()}`
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
