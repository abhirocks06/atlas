import type { Notification } from '../types'

/** How long a notification shows as "new" after being added to the dataset. */
export const NEW_NOTIFICATION_WINDOW_DAYS = 3

const WINDOW_MS = NEW_NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000

function parseDateMs(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function isNotificationNew(n: Notification, now = Date.now()): boolean {
  if (!n.addedAt) return false
  return now - parseDateMs(n.addedAt) < WINDOW_MS
}

export function getNewNotifications(notifications: Notification[]): Notification[] {
  return notifications
    .filter(isNotificationNew)
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
}

export function getNotificationKey(n: Notification): string {
  return n.sourceUrl ?? `${n.country ?? ''}|${n.date}|${n.system ?? ''}`
}
