import type { UserRoleName } from './rbac';

export interface NotificationItem {
  id: string;
  type: 'SECURITY' | 'AUDIT' | 'BLOCKCHAIN' | 'DOCUMENT' | 'CASE' | 'AI';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  roles: UserRoleName[];
}

const STORAGE_KEY = 'sih_notifications';

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-001',
    type: 'SECURITY',
    title: 'Document Integrity Verified',
    message: 'SHA-256 verification completed with zero byte mismatch.',
    timestamp: '5 min ago',
    read: false,
    roles: ['ADMIN', 'INVESTIGATOR', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    id: 'notif-002',
    type: 'AUDIT',
    title: 'New Audit Event Recorded',
    message: 'A document verification event was appended to the canonical hash chain.',
    timestamp: '12 min ago',
    read: false,
    roles: ['ADMIN', 'INVESTIGATOR', 'AUDITOR'],
  },
  {
    id: 'notif-003',
    type: 'BLOCKCHAIN',
    title: 'Document Hash Anchored',
    message: 'Evidence hash successfully committed to local EVM block #1842.',
    timestamp: '25 min ago',
    read: false,
    roles: ['ADMIN', 'AUDITOR'],
  },
  {
    id: 'notif-004',
    type: 'DOCUMENT',
    title: 'FIR Document Processed',
    message: 'Evidence document ingestion and parsing completed successfully.',
    timestamp: '40 min ago',
    read: true,
    roles: ['ADMIN', 'INVESTIGATOR', 'LEGAL_OFFICER', 'VIEWER'],
  },
  {
    id: 'notif-005',
    type: 'CASE',
    title: 'Case Document Associated',
    message: 'Evidence record associated with CASE-2026-CY-0487.',
    timestamp: '1 hour ago',
    read: true,
    roles: ['ADMIN', 'INVESTIGATOR', 'LEGAL_OFFICER', 'VIEWER'],
  },
  {
    id: 'notif-006',
    type: 'AI',
    title: 'Document Intelligence Complete',
    message: 'Local AI extraction identified key person and organization entities.',
    timestamp: '2 hours ago',
    read: true,
    roles: ['ADMIN', 'INVESTIGATOR'],
  },
];

/**
 * Get stored notifications from localStorage or return default list.
 */
export function getStoredNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading sih_notifications from localStorage:", e);
  }
  
  // Seed default list
  saveNotifications(DEFAULT_NOTIFICATIONS);
  return DEFAULT_NOTIFICATIONS;
}

/**
 * Persist notification list to localStorage.
 */
export function saveNotifications(items: NotificationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Error writing sih_notifications to localStorage:", e);
  }
}

/**
 * Filter notifications for a specific user role.
 */
export function getNotificationsForRole(items: NotificationItem[], role: UserRoleName): NotificationItem[] {
  return items.filter((n) => !n.roles || n.roles.includes(role));
}

/**
 * Calculate unread count for a specific user role.
 */
export function getUnreadCountForRole(items: NotificationItem[], role: UserRoleName): number {
  return getNotificationsForRole(items, role).filter((n) => !n.read).length;
}
