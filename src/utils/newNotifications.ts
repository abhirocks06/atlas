import type { Notification } from '../types'

/** How long a notification shows as "new" after being added to the dataset (calendar days). */
export const NEW_NOTIFICATION_WINDOW_DAYS = 3

function startOfDayMs(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

function startOfTodayMs(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

export function isNotificationNew(n: Notification, now = new Date()): boolean {
  if (!n.addedAt) return false
  const daysSinceAdded = Math.floor(
    (startOfTodayMs(now) - startOfDayMs(n.addedAt)) / (24 * 60 * 60 * 1000),
  )
  return daysSinceAdded < NEW_NOTIFICATION_WINDOW_DAYS
}

export function getNewNotifications(notifications: Notification[], now = new Date()): Notification[] {
  return notifications
    .filter(n => isNotificationNew(n, now))
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
}

export function getNotificationKey(n: Notification): string {
  return n.sourceUrl ?? `${n.country ?? ''}|${n.date}|${n.system ?? ''}`
}
