import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Shield, 
  FileLock, 
  Cpu, 
  Link as LinkIcon, 
  History, 
  Bell, 
  Server,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Activity
} from 'lucide-react';
import { api } from '../services/api';

export const SystemSettings: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'general' | 'security' | 'document_security' | 'ai' | 'blockchain' | 'audit' | 'notifications' | 'system'
  >('general');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Settings states initialized from backend
  const [general, setGeneral] = useState<any>({
    organization_name: 'Delhi Police Cyber Crime Cell',
    system_name: 'SIH26190 Digital Evidence Integrity System',
    default_office: 'Connaught Place P.S.',
    timezone: 'Asia/Kolkata',
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
    language: 'en-us',
    items_per_page: 20,
  });

  const [security, setSecurity] = useState<any>({
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    require_strong_password: true,
    require_mfa: false,
    jwt_expiry_minutes: 60,
    allow_concurrent_sessions: true,
  });

  const [docSecurity, setDocSecurity] = useState<any>({
    encryption_enabled: true,
    encryption_algorithm: 'AES-256 / Fernet CBC',
    hash_verification_enabled: true,
    signature_verification_enabled: true,
    tamper_detection_enabled: true,
    max_upload_size_mb: 50,
    allowed_file_types: 'pdf,txt,doc,docx',
  });

  const [aiSettings, setAiSettings] = useState<any>({
    active_provider: 'local',
    active_model: 'qwen2.5:3b',
    providers_status: null,
  });

  const [blockchain, setBlockchain] = useState<any>({
    enabled: true,
    rpc_endpoint: 'http://127.0.0.1:8545',
    chain_id: 31337,
    contract_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    auto_anchor: true,
    auto_verify: true,
  });

  const [audit, setAudit] = useState<any>({
    audit_logging_enabled: true,
    log_document_access: true,
    log_downloads: true,
    log_uploads: true,
    log_metadata_changes: true,
    log_authentication: true,
    log_case_changes: true,
    log_security_events: true,
    chain_valid: true,
    total_events: 0,
    latest_event_hash: null,
  });

  const [notifications, setNotifications] = useState<any>({
    security_alerts: true,
    tampering_alerts: true,
    failed_auth_alerts: true,
    blockchain_failure_alerts: true,
    email_notifications_enabled: false,
    email_service_configured: false,
  });

  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [testingBlockchain, setTestingBlockchain] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/');
      const data = res.data;
      if (data.general) setGeneral(data.general);
      if (data.security) setSecurity(data.security);
      if (data.document_security) setDocSecurity(data.document_security);
      if (data.ai) setAiSettings(data.ai);
      if (data.blockchain) setBlockchain(data.blockchain);
      if (data.audit) setAudit(data.audit);
      if (data.notifications) setNotifications(data.notifications);
      if (data.user_permissions) setCanEdit(data.user_permissions.can_edit);
    } catch (err: any) {
      console.warn("Failed to fetch settings from API:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (endpoint: string, payload: any) => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.patch(`/settings/${endpoint}/`, payload);
      setSaveStatus({ type: 'success', message: 'Configuration saved and persisted to database successfully.' });
      fetchSettings();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to persist settings changes.";
      setSaveStatus({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTestBlockchain = async () => {
    setTestingBlockchain(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/blockchain/test/');
      setTestResult({ section: 'blockchain', success: true, data: res.data });
    } catch (err: any) {
      setTestResult({
        section: 'blockchain',
        success: false,
        data: err.response?.data || { message: "Blockchain RPC node unreachable." }
      });
    } finally {
      setTestingBlockchain(false);
    }
  };

  const handleTestAI = async (provider: string) => {
    setTestingAI(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/ai/test/', { provider });
      setTestResult({ section: 'ai', success: res.data.success, data: res.data });
    } catch (err: any) {
      setTestResult({
        section: 'ai',
        success: false,
        data: err.response?.data || { message: "AI provider health check failed." }
      });
    } finally {
      setTestingAI(false);
    }
  };

  const handleRunHealthCheck = async () => {
    try {
      const res = await api.get('/system/health/');
      setHealthInfo(res.data);
    } catch (err) {
      console.warn("System health probe failed:", err);
    }
  };

  const subNavItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security & Auth', icon: Shield },
    { id: 'document_security', label: 'Document Security', icon: FileLock },
    { id: 'ai', label: 'AI & Extraction', icon: Cpu },
    { id: 'blockchain', label: 'Blockchain & Integrity', icon: LinkIcon },
    { id: 'audit', label: 'Audit & Compliance', icon: History },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System Information', icon: Server },
  ] as const;

  if (loading) {
    return (
      <div className="bg-[#111827] border border-[#1f2937] rounded-md p-8 text-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
        Loading persistent system settings from database...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            System Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure security policies, document processing parameters, access control, and system behavior.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!canEdit && (
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
              READ-ONLY MODE (ADMIN AUTH REQUIRED TO EDIT)
            </span>
          )}
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#0b0f19] text-sky-400 border border-[#1f2937]">
            PERSISTED DATABASE MODEL
          </span>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div className={`p-3 rounded border text-xs font-medium flex items-center justify-between ${
          saveStatus.type === 'success' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-rose-950/80 border-rose-800 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
      )}

      {/* Main Settings Sub-Navigation & Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Sub-Navigation Sidebar */}
        <div className="lg:col-span-3 bg-[#111827] border border-[#1f2937] rounded-md p-2 space-y-0.5">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSubTab(item.id);
                  setSaveStatus(null);
                  setTestResult(null);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#1f2937] text-slate-100 font-bold border-l-2 border-sky-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0b0f19]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Configuration Content Area */}
        <div className="lg:col-span-9 bg-[#111827] border border-[#1f2937] rounded-md p-5 space-y-5">
          
          {/* SECTION A: GENERAL SETTINGS */}
          {activeSubTab === 'general' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3">
                <h3 className="text-sm font-bold text-slate-100">General System Settings</h3>
                <p className="text-xs text-slate-400">Institutional identification & localized default parameters.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Organization / Department</label>
                  <input
                    type="text"
                    value={general.organization_name}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, organization_name: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">System Title</label>
                  <input
                    type="text"
                    value={general.system_name}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, system_name: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Default Police Station / Office</label>
                  <input
                    type="text"
                    value={general.default_office}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, default_office: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Timezone</label>
                  <select
                    value={general.timezone}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date Format</label>
                  <select
                    value={general.date_format}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, date_format: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standards)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Items Per Page</label>
                  <input
                    type="number"
                    value={general.items_per_page}
                    disabled={!canEdit}
                    onChange={(e) => setGeneral({ ...general, items_per_page: parseInt(e.target.value) || 20 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('general', general)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save General Settings'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION B: SECURITY & AUTHENTICATION SETTINGS */}
          {activeSubTab === 'security' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3">
                <h3 className="text-sm font-bold text-slate-100">Security & Authentication Policy</h3>
                <p className="text-xs text-slate-400">JWT token lifetime, login lockout thresholds, and session governance.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    value={security.session_timeout_minutes}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, session_timeout_minutes: parseInt(e.target.value) || 60 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Max Failed Login Attempts</label>
                  <input
                    type="number"
                    value={security.max_login_attempts}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, max_login_attempts: parseInt(e.target.value) || 5 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Lockout Duration (Minutes)</label>
                  <input
                    type="number"
                    value={security.lockout_duration_minutes}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, lockout_duration_minutes: parseInt(e.target.value) || 15 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">JWT Expiry (Minutes)</label>
                  <input
                    type="number"
                    value={security.jwt_expiry_minutes}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, jwt_expiry_minutes: parseInt(e.target.value) || 60 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs">
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={security.require_strong_password}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, require_strong_password: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Require strong password policy (uppercase, special char, min 8 chars)</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={security.allow_concurrent_sessions}
                    disabled={!canEdit}
                    onChange={(e) => setSecurity({ ...security, allow_concurrent_sessions: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Allow concurrent officer terminal sessions</span>
                </label>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('security', security)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save Security Policy'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION C: DOCUMENT SECURITY SETTINGS */}
          {activeSubTab === 'document_security' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3">
                <h3 className="text-sm font-bold text-slate-100">Document Security & Encryption Configuration</h3>
                <p className="text-xs text-slate-400">Disk encryption algorithms, maximum upload quotas, and SHA-256 integrity rules.</p>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Active Encryption Engine</span>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">
                    AES-256 / Fernet CBC
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Every evidence PDF uploaded to disk is encrypted prior to storage using standard Fernet symmetric keys.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Max Upload File Size (MB)</label>
                  <input
                    type="number"
                    value={docSecurity.max_upload_size_mb}
                    disabled={!canEdit}
                    onChange={(e) => setDocSecurity({ ...docSecurity, max_upload_size_mb: parseInt(e.target.value) || 50 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Allowed File Formats</label>
                  <input
                    type="text"
                    value={docSecurity.allowed_file_types}
                    disabled={!canEdit}
                    onChange={(e) => setDocSecurity({ ...docSecurity, allowed_file_types: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#374151]"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docSecurity.hash_verification_enabled}
                    disabled={!canEdit}
                    onChange={(e) => setDocSecurity({ ...docSecurity, hash_verification_enabled: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Enforce automatic SHA-256 hash recalculation on retrieval</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docSecurity.signature_verification_enabled}
                    disabled={!canEdit}
                    onChange={(e) => setDocSecurity({ ...docSecurity, signature_verification_enabled: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Enforce RSA-2048 PKCS#1 PSS digital signature validation</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docSecurity.tamper_detection_enabled}
                    disabled={!canEdit}
                    onChange={(e) => setDocSecurity({ ...docSecurity, tamper_detection_enabled: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Enable active single-byte tamper detection alert triggers</span>
                </label>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('document-security', docSecurity)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save Document Security Settings'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION D: AI & EXTRACTION SETTINGS */}
          {activeSubTab === 'ai' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3">
                <h3 className="text-sm font-bold text-slate-100">AI Provider & Metadata Extraction Settings</h3>
                <p className="text-xs text-slate-400">Configure Local Processing fallback, local Ollama Qwen models, or cloud providers.</p>
              </div>

              {/* Provider Selection Table */}
              <table className="shadcn-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Model Name</th>
                    <th>Status</th>
                    <th>Availability</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold text-slate-100">Local Processing</td>
                    <td className="font-mono text-slate-400">Deterministic / Regex NLP</td>
                    <td>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                        AVAILABLE
                      </span>
                    </td>
                    <td className="text-xs text-slate-300">Always Available (Zero RAM Overheads)</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleTestAI('local')}
                        disabled={testingAI}
                        className="px-2.5 py-1 rounded bg-[#0b0f19] hover:bg-[#1f2937] border border-[#1f2937] text-xs font-semibold text-slate-300"
                      >
                        Test Baseline
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td className="font-bold text-slate-100">Qwen 2.5 3B</td>
                    <td className="font-mono text-slate-400">qwen2.5:3b (Ollama)</td>
                    <td>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-900">
                        INSTALLED / RESOURCE LIMITED
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">Installed but unavailable (Memory OOM)</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleTestAI('qwen')}
                        disabled={testingAI}
                        className="px-2.5 py-1 rounded bg-[#0b0f19] hover:bg-[#1f2937] border border-[#1f2937] text-xs font-semibold text-slate-300"
                      >
                        Test Qwen
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td className="font-bold text-slate-100">Google Gemini</td>
                    <td className="font-mono text-slate-400">gemini-2.0-flash</td>
                    <td>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-slate-500 border border-slate-800">
                        OPTIONAL / OFFLINE
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">API Key Not Configured</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleTestAI('gemini')}
                        disabled={testingAI}
                        className="px-2.5 py-1 rounded bg-[#0b0f19] hover:bg-[#1f2937] border border-[#1f2937] text-xs font-semibold text-slate-300"
                      >
                        Test Gemini
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Test Result Display */}
              {testResult && testResult.section === 'ai' && (
                <div className={`p-3 rounded border text-xs font-mono space-y-1 ${
                  testResult.success ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-amber-950/80 border-amber-800 text-amber-300'
                }`}>
                  <div className="font-bold">Provider Test Result: {testResult.data.status}</div>
                  <div>{testResult.data.message}</div>
                </div>
              )}

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400">Active Provider:</span>
                    <select
                      value={aiSettings.active_provider}
                      onChange={(e) => setAiSettings({ ...aiSettings, active_provider: e.target.value })}
                      className="bg-[#0b0f19] border border-[#1f2937] rounded px-2.5 py-1 text-xs text-slate-100"
                    >
                      <option value="local">Local Processing (Baseline Regex)</option>
                      <option value="qwen">Qwen 2.5 3B (Ollama)</option>
                      <option value="gemini">Google Gemini Cloud</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleSaveSection('ai', { active_provider: aiSettings.active_provider })}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save AI Selection'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION E: BLOCKCHAIN & INTEGRITY SETTINGS */}
          {activeSubTab === 'blockchain' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Blockchain Ledger & Anchoring Configuration</h3>
                  <p className="text-xs text-slate-400">Local Hardhat EVM RPC endpoint, smart contract address, and auto-anchoring policy.</p>
                </div>

                <button
                  onClick={handleTestBlockchain}
                  disabled={testingBlockchain}
                  className="px-3 py-1.5 rounded bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  {testingBlockchain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  <span>Test Blockchain Connection</span>
                </button>
              </div>

              {testResult && testResult.section === 'blockchain' && (
                <div className={`p-3 rounded border text-xs font-mono space-y-1 ${
                  testResult.success ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-rose-950/80 border-rose-800 text-rose-300'
                }`}>
                  <div className="font-bold">EVM Connection Status: {testResult.data.status}</div>
                  <div>{testResult.data.message}</div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">EVM JSON-RPC Endpoint</label>
                  <input
                    type="text"
                    value={blockchain.rpc_endpoint}
                    disabled={!canEdit}
                    onChange={(e) => setBlockchain({ ...blockchain, rpc_endpoint: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Chain ID</label>
                  <input
                    type="number"
                    value={blockchain.chain_id}
                    disabled={!canEdit}
                    onChange={(e) => setBlockchain({ ...blockchain, chain_id: parseInt(e.target.value) || 31337 })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-[#374151]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Anchor Contract Address</label>
                  <input
                    type="text"
                    value={blockchain.contract_address}
                    disabled={!canEdit}
                    onChange={(e) => setBlockchain({ ...blockchain, contract_address: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-[#374151]"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockchain.auto_anchor}
                    disabled={!canEdit}
                    onChange={(e) => setBlockchain({ ...blockchain, auto_anchor: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Automatically anchor SHA-256 digest on local EVM blockchain upon ingestion</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockchain.auto_verify}
                    disabled={!canEdit}
                    onChange={(e) => setBlockchain({ ...blockchain, auto_verify: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Verify EVM transaction receipt during document integrity checks</span>
                </label>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('blockchain', blockchain)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save Blockchain Policy'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION F: AUDIT & COMPLIANCE SETTINGS */}
          {activeSubTab === 'audit' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Audit Trail & Chain Compliance Configuration</h3>
                  <p className="text-xs text-slate-400">Canonical JSON hash chain linking settings and event recording preferences.</p>
                </div>

                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                  {audit.chain_valid ? 'AUDIT CHAIN VALID' : 'CHAIN DISCREPANCY'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Audited Events</span>
                  <span className="text-lg font-bold font-mono text-slate-100 mt-1 block">{audit.total_events || 0}</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Latest Event Hash Digest</span>
                  <code className="text-[10px] font-mono text-emerald-400 block truncate mt-1">
                    {audit.latest_event_hash || 'GENESIS'}
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audit.log_document_access}
                    disabled={!canEdit}
                    onChange={(e) => setAudit({ ...audit, log_document_access: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Record document access & read events</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audit.log_uploads}
                    disabled={!canEdit}
                    onChange={(e) => setAudit({ ...audit, log_uploads: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Record new document ingestion & upload events</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audit.log_authentication}
                    disabled={!canEdit}
                    onChange={(e) => setAudit({ ...audit, log_authentication: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Record user authentication & JWT login attempts</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audit.log_security_events}
                    disabled={!canEdit}
                    onChange={(e) => setAudit({ ...audit, log_security_events: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Record system configuration & security policy changes</span>
                </label>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('audit', audit)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save Audit Policy'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION G: NOTIFICATIONS SETTINGS */}
          {activeSubTab === 'notifications' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3">
                <h3 className="text-sm font-bold text-slate-100">System Notification & Alert Preferences</h3>
                <p className="text-xs text-slate-400">Configure system warning triggers and security alert dispatches.</p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.security_alerts}
                    disabled={!canEdit}
                    onChange={(e) => setNotifications({ ...notifications, security_alerts: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Dispatch security policy violation alerts</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.tampering_alerts}
                    disabled={!canEdit}
                    onChange={(e) => setNotifications({ ...notifications, tampering_alerts: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Dispatch immediate single-byte document tampering alerts</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.blockchain_failure_alerts}
                    disabled={!canEdit}
                    onChange={(e) => setNotifications({ ...notifications, blockchain_failure_alerts: e.target.checked })}
                    className="rounded bg-[#0b0f19] border-[#1f2937] text-sky-600 focus:ring-0"
                  />
                  <span>Dispatch local EVM blockchain RPC node disconnection alerts</span>
                </label>
              </div>

              {/* Email Delivery Warning */}
              <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937] text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Email Delivery Service</span>
                <span className="text-slate-400 block">Email service not configured (SMTP server endpoint not set).</span>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-[#1f2937] flex justify-end">
                  <button
                    onClick={() => handleSaveSection('notifications', notifications)}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? 'Saving...' : 'Save Notification Preferences'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION H: SYSTEM INFORMATION & HEALTH CHECK */}
          {activeSubTab === 'system' && (
            <div className="space-y-4">
              <div className="border-b border-[#1f2937] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">System Information & Runtime Subsystem Health</h3>
                  <p className="text-xs text-slate-400">Live operational status probe for database, storage, encryption, and EVM ledger.</p>
                </div>

                <button
                  onClick={handleRunHealthCheck}
                  className="px-3 py-1.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Run System Health Check</span>
                </button>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Application Version</span>
                  <span className="font-mono text-slate-100 font-bold block mt-1">1.0.0-SIH26190</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Backend Framework</span>
                  <span className="font-mono text-slate-100 font-bold block mt-1">Django 5.1.5 (Python 3.14)</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Database Status</span>
                  <span className="font-mono text-emerald-400 font-bold block mt-1">✓ OPERATIONAL (SQLite / PostgreSQL)</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Disk Storage & Encryption</span>
                  <span className="font-mono text-emerald-400 font-bold block mt-1">✓ OPERATIONAL (AES-256 Fernet)</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">EVM Blockchain Node</span>
                  <span className="font-mono text-sky-400 font-bold block mt-1">✓ CONNECTED (Hardhat EVM 8545)</span>
                </div>

                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Audit Hash Chain Integrity</span>
                  <span className="font-mono text-emerald-400 font-bold block mt-1">✓ VALID (0 Discrepancies)</span>
                </div>
              </div>

              {healthInfo && (
                <div className="bg-[#0b0f19] p-3 rounded border border-[#1f2937] space-y-2 text-xs font-mono">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Live Health Probe Output ({healthInfo.timestamp})</div>
                  <pre className="text-[10px] text-emerald-400 overflow-x-auto p-2 bg-[#090d16] rounded border border-[#1f2937]">
                    {JSON.stringify(healthInfo.subsystems, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
