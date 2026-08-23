/**
 * SIH26190 Centralized Role-Based Access Control (RBAC) System
 * Provides strongly typed role permissions, navigation guards, and action capabilities.
 */

export type UserRoleName = 'ADMIN' | 'INVESTIGATOR' | 'LEGAL_OFFICER' | 'AUDITOR' | 'VIEWER';

export type NavigationTab = 
  | 'overview'
  | 'cases'
  | 'documents'
  | 'ingestion'
  | 'integrity'
  | 'signatures'
  | 'audit'
  | 'blockchain'
  | 'ai_extraction'
  | 'users_access'
  | 'system_settings'
  | 'graph'
  | 'export';

export type Capability = 
  | 'canUploadDocument'
  | 'canCreateCase'
  | 'canEditCase'
  | 'canSignDocument'
  | 'canViewAudit'
  | 'canViewBlockchain'
  | 'canManageUsers'
  | 'canManageSettings'
  | 'canManageAI';

export interface RoleConfig {
  name: string;
  description: string;
  allowedTabs: NavigationTab[];
  capabilities: Set<Capability>;
}

export const ROLE_PERMISSIONS: Record<UserRoleName, RoleConfig> = {
  ADMIN: {
    name: 'Administrator',
    description: 'Full system administration, security configuration, user management, and auditing.',
    allowedTabs: [
      'overview',
      'cases',
      'documents',
      'ingestion',
      'integrity',
      'signatures',
      'audit',
      'blockchain',
      'ai_extraction',
      'users_access',
      'system_settings',
      'graph',
      'export',
    ],
    capabilities: new Set<Capability>([
      'canUploadDocument',
      'canCreateCase',
      'canEditCase',
      'canSignDocument',
      'canViewAudit',
      'canViewBlockchain',
      'canManageUsers',
      'canManageSettings',
      'canManageAI',
    ]),
  },

  INVESTIGATOR: {
    name: 'Cyber Crime Investigator',
    description: 'Active case investigation, evidence document ingestion, search, and AI entity extraction.',
    allowedTabs: [
      'overview',
      'cases',
      'documents',
      'ingestion',
      'integrity',
      'signatures',
      'audit',
      'ai_extraction',
      'graph',
      'export',
    ],
    capabilities: new Set<Capability>([
      'canUploadDocument',
      'canCreateCase',
      'canEditCase',
      'canViewAudit',
      'canViewBlockchain',
    ]),
  },

  LEGAL_OFFICER: {
    name: 'Legal & Prosecution Officer',
    description: 'Legal dossier review, court filings, document integrity verification, and RSA digital signatures.',
    allowedTabs: [
      'overview',
      'cases',
      'documents',
      'ingestion',
      'integrity',
      'signatures',
      'export',
    ],
    capabilities: new Set<Capability>([
      'canUploadDocument',
      'canCreateCase',
      'canEditCase',
      'canSignDocument',
    ]),
  },

  AUDITOR: {
    name: 'Compliance & Judicial Auditor',
    description: 'Read-only security role for verifying audit trails, SHA-256 hash chains, and EVM blockchain records.',
    allowedTabs: [
      'overview',
      'integrity',
      'signatures',
      'audit',
      'blockchain',
      'graph',
    ],
    capabilities: new Set<Capability>([
      'canViewAudit',
      'canViewBlockchain',
    ]),
  },

  VIEWER: {
    name: 'Operational Viewer',
    description: 'Read-only access to assigned evidence documents and active case dossiers.',
    allowedTabs: [
      'overview',
      'cases',
      'documents',
    ],
    capabilities: new Set<Capability>([]),
  },
};

/**
 * Check if a role can access a navigation tab.
 */
export function canAccessTab(role: UserRoleName | undefined, tab: string): boolean {
  if (!role || !ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].allowedTabs.includes(tab as NavigationTab);
}

/**
 * Check if a role has a specific action capability.
 */
export function hasCapability(role: UserRoleName | undefined, capability: Capability): boolean {
  if (!role || !ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].capabilities.has(capability);
}

/**
 * Get navigation items allowed for the specified role.
 */
export function getNavigationForRole(role: UserRoleName | undefined) {
  const allowed = role && ROLE_PERMISSIONS[role] ? ROLE_PERMISSIONS[role].allowedTabs : [];
  return allowed;
}
