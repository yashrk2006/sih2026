import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  LayoutDashboard,
  Briefcase,
  FileText,
  Search as SearchIcon,
  History,
  Cpu,
  ShieldCheck,
  FileCheck,
  Link as LinkIcon,
  Users,
  Settings,
  Bell,
  LogOut,
  HelpCircle,
  ChevronDown,
  Menu,
  X,
  MoreHorizontal,
  Network,
  FileOutput,
  Upload,
} from 'lucide-react';
import type { UserRole } from '../services/api';
import { canAccessTab } from '../services/rbac';
import {
  getStoredNotifications,
  saveNotifications,
  getNotificationsForRole,
  getUnreadCountForRole,
} from '../services/notificationService';
import type { NotificationItem } from '../services/notificationService';
import { NotificationPopover } from './NotificationPopover';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserRole;
  onSelectRole: (role: 'ADMIN' | 'INVESTIGATOR' | 'LEGAL_OFFICER' | 'VIEWER' | 'AUDITOR') => void;
  onOpenGuide: () => void;
  onLogout: () => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const navGroups = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'cases', label: 'Cases', icon: Briefcase },
      { id: 'documents', label: 'Documents', icon: FileText },
      { id: 'ingestion', label: 'Upload Evidence', icon: Upload },
      { id: 'search', label: 'Evidence Search', icon: SearchIcon },
    ],
  },
  {
    group: 'SECURITY',
    items: [
      { id: 'integrity', label: 'Integrity Checks', icon: ShieldCheck },
      { id: 'signatures', label: 'Digital Signatures', icon: FileCheck },
      { id: 'audit', label: 'Audit Trail', icon: History },
      { id: 'blockchain', label: 'Blockchain Records', icon: LinkIcon },
    ],
  },
  {
    group: 'INTELLIGENCE',
    items: [
      { id: 'graph', label: 'Relationship Graph', icon: Network },
      { id: 'export', label: 'Section 65B Export', icon: FileOutput },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      { id: 'ai_extraction', label: 'AI Processing', icon: Cpu },
      { id: 'users_access', label: 'Users & Roles', icon: Users },
      { id: 'system_settings', label: 'Settings', icon: Settings },
    ],
  },
];

const mobileBottomTabs = ['overview', 'cases', 'documents', 'search'];
const mobileBottomIcons: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  cases: Briefcase,
  documents: FileText,
  search: SearchIcon,
};
const mobileBottomLabels: Record<string, string> = {
  overview: 'Home',
  cases: 'Cases',
  documents: 'Docs',
  search: 'Search',
};

function getRoleColor(role: string) {
  if (role === 'ADMIN') return 'var(--purple-text)';
  if (role === 'LEGAL_OFFICER') return 'var(--amber-text)';
  if (role === 'INVESTIGATOR') return 'var(--accent-hover)';
  if (role === 'AUDITOR') return 'var(--green-text)';
  return 'var(--text-muted)';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onSelectRole,
  onOpenGuide,
  onLogout,
  globalSearchQuery,
  setGlobalSearchQuery,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(getStoredNotifications());
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setIsNotificationsOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
        setUserMenuOpen(false);
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [setSidebarOpen]);

  const handleMarkRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => {
      if (!n.roles || n.roles.includes(currentUser.role)) return { ...n, read: true };
      return n;
    });
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleClearSingle = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleClearAll = () => {
    const updated = notifications.filter((n) => n.roles && !n.roles.includes(currentUser.role));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const roleNotifs = getNotificationsForRole(notifications, currentUser.role);
  const unreadCount = getUnreadCountForRole(notifications, currentUser.role);

  const displayName = currentUser.username === 'admin' ? 'Admin' : currentUser.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setSidebarOpen(false); // close mobile sidebar on nav
  };

  const isActive = (id: string) =>
    activeTab === id ||
    (id === 'overview' && activeTab === 'dashboard') ||
    (id === 'ai_extraction' && activeTab === 'ai_providers') ||
    (id === 'system_settings' && activeTab === 'settings');

  const SidebarContent = () => (
    <>
      <nav style={{ flex: 1, padding: '0.5rem 0.5rem 1rem' }}>
        {navGroups.map((grp) => {
          const visibleItems = grp.items.filter((item) => {
            if (item.id === 'search') return canAccessTab(currentUser.role, 'documents');
            return canAccessTab(currentUser.role, item.id);
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={grp.group} style={{ marginBottom: '1rem' }}>
              <div className="nav-group-label">{grp.group}</div>
              <div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.id);
                  return (
                    <button
                      key={item.id}
                      className={`nav-item${active ? ' active' : ''}`}
                      onClick={() => handleNavClick(item.id)}
                    >
                      <Icon size={14} className="nav-icon" style={{ flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom user card */}
      <div
        style={{
          padding: '0.625rem 0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}
      >
        <div
          style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-hover)',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="truncate-text" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '0.6875rem', color: getRoleColor(currentUser.role), fontFamily: 'JetBrains Mono, monospace' }}>
            {currentUser.role}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ===================== TOP HEADER ===================== */}
      <header className="app-header">
        {/* Mobile hamburger */}
        <button
          className="hide-desktop"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '0 0.875rem',
            display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0,
          }}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Brand */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            width: 'var(--sidebar-width)', flexShrink: 0, paddingLeft: '0.875rem',
          }}
          className="hide-mobile"
        >
          <div
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              borderRadius: '5px',
              padding: '5px',
              color: 'var(--accent-hover)',
              display: 'flex',
            }}
          >
            <Shield size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)', textTransform: 'uppercase', lineHeight: 1.1 }}>
              SIH26190
            </div>
            <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>
              Secure DMS
            </div>
          </div>
        </div>

        {/* Mobile brand (compact) */}
        <div
          className="hide-desktop"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            paddingLeft: '0.25rem',
          }}
        >
          <Shield size={14} style={{ color: 'var(--accent-hover)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>SIH26190</span>
        </div>

        {/* Search bar — desktop */}
        <div style={{ flex: 1, maxWidth: '420px', margin: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="hide-mobile">
          <div className="input-icon" style={{ position: 'relative', flex: 1 }}>
            <SearchIcon
              size={13}
              style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search cases, documents, evidence..."
              value={globalSearchQuery}
              onChange={(e) => {
                setGlobalSearchQuery(e.target.value);
                if (activeTab !== 'search' && activeTab !== 'documents') setActiveTab('search');
              }}
              style={{ paddingLeft: '2rem', height: '32px' }}
            />
          </div>
          {/* ⌘K Command Palette pill */}
          <kbd
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            title="Open Command Palette (Ctrl+K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border)',
              background: 'var(--surface-raised)',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        </div>

        <div style={{ flex: 1 }} className="hide-desktop" />

        {/* Right section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', paddingRight: '0.875rem', marginLeft: 'auto' }}>
          {/* Guide button — desktop only */}
          <button
            onClick={onOpenGuide}
            className="btn btn-ghost btn-sm hide-mobile"
            style={{ gap: '0.25rem', height: '30px' }}
          >
            <HelpCircle size={13} style={{ color: 'var(--amber-text)' }} />
            <span style={{ color: 'var(--amber-text)', fontSize: '0.75rem' }}>Demo Guide</span>
          </button>

          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((p) => !p)}
              aria-label="Notifications"
              style={{
                background: isNotificationsOpen ? 'var(--surface-raised)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '0.3rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center',
                position: 'relative',
                minHeight: '32px', minWidth: '32px', justifyContent: 'center',
              }}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute', top: '2px', right: '2px',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: '0.5625rem', fontWeight: 700,
                    width: '14px', height: '14px',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {isNotificationsOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200 }}>
                <NotificationPopover
                  notifications={roleNotifs}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onClearSingle={handleClearSingle}
                  onClearAll={handleClearAll}
                  onClose={() => setIsNotificationsOpen(false)}
                />
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: userMenuOpen ? 'var(--surface-raised)' : 'none',
                border: '1px solid transparent',
                borderColor: userMenuOpen ? 'var(--border)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                minHeight: '32px',
              }}
            >
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.5625rem', fontWeight: 700, color: 'var(--accent-hover)',
                }}
              >
                {initials}
              </div>
              <div className="hide-mobile" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.5625rem', color: getRoleColor(currentUser.role), fontFamily: 'JetBrains Mono, monospace' }}>
                  {currentUser.role}
                </div>
              </div>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} className="hide-mobile" />
            </button>

            {userMenuOpen && (
              <div
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  width: 220, zIndex: 200,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-overlay)',
                  overflow: 'hidden',
                }}
              >
                {/* User info */}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{currentUser.email}</div>
                </div>

                {/* RBAC role switcher */}
                <div style={{ padding: '0.375rem 0' }}>
                  <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)' }}>
                    Switch Role
                  </div>
                  {(['ADMIN', 'INVESTIGATOR', 'LEGAL_OFFICER', 'AUDITOR', 'VIEWER'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => { onSelectRole(role); setUserMenuOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '0.375rem 0.75rem',
                        background: currentUser.role === role ? 'var(--accent-subtle)' : 'none',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: '0.8125rem',
                        color: currentUser.role === role ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      }}
                    >
                      <span>{role.replace('_', ' ')}</span>
                      {currentUser.role === role && (
                        <span style={{ fontSize: '0.5625rem', color: 'var(--green-text)', fontFamily: 'monospace' }}>● ACTIVE</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Sign out */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.375rem 0' }}>
                  <button
                    onClick={() => { onLogout(); setUserMenuOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '0.4375rem 0.75rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontSize: '0.8125rem', color: 'var(--red-text)',
                    }}
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================== SIDEBAR — DESKTOP ===================== */}
      <aside className="app-sidebar hide-mobile">
        <SidebarContent />
      </aside>

      {/* ===================== SIDEBAR — MOBILE OVERLAY ===================== */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`app-sidebar hide-desktop${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={14} style={{ color: 'var(--accent-hover)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Navigation</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* ===================== MOBILE BOTTOM NAV ===================== */}
      <nav className="mobile-bottom-nav">
        {mobileBottomTabs.map((tab) => {
          if (!canAccessTab(currentUser.role, tab === 'search' ? 'documents' : tab)) return null;
          const Icon = mobileBottomIcons[tab];
          const active = isActive(tab);
          return (
            <button
              key={tab}
              className={`mobile-nav-item${active ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={18} />
              <span>{mobileBottomLabels[tab]}</span>
            </button>
          );
        })}

        {/* More button — opens sidebar */}
        <button
          className={`mobile-nav-item${!mobileBottomTabs.includes(activeTab) ? ' active' : ''}`}
          onClick={() => setSidebarOpen(true)}
        >
          <MoreHorizontal size={18} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
};
