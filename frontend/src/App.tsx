import { useEffect, useState } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { CommandCenter } from './components/CommandCenter';
import { CaseManagement } from './components/CaseManagement';
import { DocumentManager } from './components/DocumentManager';
import { EvidenceSearch } from './components/EvidenceSearch';
import { IngestionStudio } from './components/IngestionStudio';
import { IntegrityVerification } from './components/IntegrityVerification';
import { DigitalSignatures } from './components/DigitalSignatures';
import { BlockchainRecords } from './components/BlockchainRecords';
import { AuditTimeline } from './components/AuditTimeline';
import { AISettingsPanel } from './components/AISettingsPanel';
import { SecurityOverview } from './components/SecurityOverview';
import { SystemSettings } from './components/SystemSettings';
import { PresentationGuideModal } from './components/PresentationGuideModal';
import { LoginModal } from './components/LoginModal';
import { CommandPalette } from './components/CommandPalette';
import { OfflineBanner } from './components/OfflineBanner';
import { IntelligenceGraph } from './components/IntelligenceGraph';
import { Section65BExport } from './components/Section65BExport';
import { PoliceAssets } from './components/PoliceAssets';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import { api, getAccessToken, setAuthTokens, clearAuthTokens } from './services/api';
import type { UserRole } from './services/api';
import { canAccessTab } from './services/rbac';
import { useOfflineQueue } from './hooks/useOfflineQueue';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const { isOnline, queue, isSyncing, lastSyncCount, syncQueue, clearQueue } = useOfflineQueue();

  useEffect(() => {
    const bootAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const res = await api.get('/users/me/');
          setCurrentUser({
            username: res.data.username,
            role: res.data.role || 'ADMIN',
            email: res.data.email || `${res.data.username}@sih26190.local`,
          });
        } catch {
          clearAuthTokens();
          setCurrentUser(null);
        }
      }
      setIsInitializing(false);
    };

    bootAuth();

    // ⌘K / Ctrl+K global command palette shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleLogoutEvent = () => setCurrentUser(null);
    window.addEventListener('sih_auth_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('sih_auth_logout', handleLogoutEvent);
    };
  }, []);

  const handleRoleSelect = async (role: UserRole['role']) => {
    const roleUserMap: Record<UserRole['role'], string> = {
      ADMIN: 'admin',
      INVESTIGATOR: 'investigator1',
      LEGAL_OFFICER: 'legal1',
      AUDITOR: 'auditor1',
      VIEWER: 'demo_viewer',
    };
    const uname = roleUserMap[role];
    try {
      const res = await api.post('/auth/token/', { username: uname, password: 'SecurePass123!' });
      setAuthTokens(res.data.access, res.data.refresh);
      setCurrentUser({ username: uname, role, email: `${uname}@sih26190.local` });
      if (!canAccessTab(role, activeTab)) setActiveTab('overview');
    } catch (e) {
      console.warn('Failed to switch role:', e);
    }
  };

  const handleLogout = () => {
    clearAuthTokens();
    setCurrentUser(null);
  };

  if (isInitializing) {
    return (
      <div
        style={{
          minHeight: '100vh', background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        }}
      >
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
          Authenticating…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginModal onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isAuthorized =
    canAccessTab(currentUser.role, activeTab) ||
    (activeTab === 'search' && canAccessTab(currentUser.role, 'documents'));

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onSelectRole={handleRoleSelect}
        onOpenGuide={() => setIsGuideOpen(true)}
        onLogout={handleLogout}
        globalSearchQuery={globalSearchQuery}
        setGlobalSearchQuery={setGlobalSearchQuery}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <main className="app-main">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {!isAuthorized ? (
            <div
              style={{
                background: 'var(--surface)', border: '1px solid rgba(218,54,51,0.3)',
                borderRadius: 'var(--radius)', padding: '3rem 2rem', textAlign: 'center',
              }}
            >
              <ShieldAlert size={36} style={{ color: 'var(--red-text)', margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                403 — Access Denied
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem', maxWidth: '360px', margin: '0 auto 1.25rem' }}>
                Role <span style={{ fontFamily: 'monospace', color: 'var(--accent-hover)' }}>{currentUser.role}</span> is
                not permitted to access <span style={{ fontFamily: 'monospace' }}>{activeTab}</span>.
              </p>
              <button className="btn btn-ghost" onClick={() => setActiveTab('overview')}>
                <ArrowLeft size={14} />
                Return to Overview
              </button>
            </div>
          ) : (
            <>
              {(activeTab === 'overview' || activeTab === 'dashboard') && (
                <CommandCenter currentUserRole={currentUser.role} onNavigateTab={setActiveTab} />
              )}
              {activeTab === 'cases' && <CaseManagement currentUserRole={currentUser.role} />}
              {activeTab === 'documents' && <DocumentManager currentUserRole={currentUser.role} />}
              {activeTab === 'search' && (
                <EvidenceSearch currentUserRole={currentUser.role} globalSearchQuery={globalSearchQuery} />
              )}
              {activeTab === 'ingestion' && <IngestionStudio />}
              {activeTab === 'integrity' && <IntegrityVerification />}
              {activeTab === 'signatures' && <DigitalSignatures />}
              {activeTab === 'blockchain' && <BlockchainRecords />}
              {activeTab === 'audit' && <AuditTimeline />}
              {(activeTab === 'ai_extraction' || activeTab === 'ai_providers') && <AISettingsPanel />}
              {activeTab === 'users_access' && <SecurityOverview />}
              {(activeTab === 'system_settings' || activeTab === 'settings') && <SystemSettings />}
              {activeTab === 'graph' && <IntelligenceGraph />}
              {activeTab === 'export' && <Section65BExport />}
              {activeTab === 'police_assets' && <PoliceAssets />}
              {activeTab === 'compliance' && <ComplianceDashboard />}
            </>
          )}
        </div>
      </main>

      <PresentationGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateTab={setActiveTab}
      />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onNavigate={(tab) => { setActiveTab(tab); setIsPaletteOpen(false); }}
      />

      <OfflineBanner
        isOnline={isOnline}
        queue={queue}
        isSyncing={isSyncing}
        lastSyncCount={lastSyncCount}
        onSync={syncQueue}
        onClear={clearQueue}
      />
    </div>
  );
}

export default App;
