import React, { useState, useEffect } from 'react';
import { Shield, Laptop, HardDrive, Truck, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingState, EmptyState } from './ui/States';
import { api } from '../services/api';

interface Asset {
  id: number;
  asset_id: string;
  asset_type: string;
  asset_name: string;
  serial_number: string;
  department: string;
  current_holder: number | null;
  holder_username: string | null;
  case: number | null;
  case_title: string | null;
  case_id_str: string | null;
  status: string;
  condition: string;
  location: string;
  notes: string;
  created_at: string;
}

export const PoliceAssets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog states
  const [registerOpen, setRegisterOpen] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Form states - Registration
  const [newAssetId, setNewAssetId] = useState('');
  const [newType, setNewType] = useState('LAPTOP');
  const [newName, setNewName] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Form states - Transition
  const [action, setAction] = useState('ASSIGN');
  const [holderUsername, setHolderUsername] = useState('');
  const [caseId, setCaseId] = useState('');
  const [transNotes, setTransNotes] = useState('');
  const [transLoc, setTransLoc] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/assets/');
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assets/', {
        asset_id: newAssetId,
        asset_type: newType,
        asset_name: newName,
        serial_number: newSerial,
        department: newDept,
        location: newLoc,
        notes: newNotes,
      });
      setRegisterOpen(false);
      // reset form
      setNewAssetId('');
      setNewName('');
      setNewSerial('');
      setNewDept('');
      setNewLoc('');
      setNewNotes('');
      fetchAssets();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to register asset');
    }
  };

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await api.post(`/assets/${selectedAsset.id}/transition/`, {
        action,
        holder_username: holderUsername,
        case_id: caseId,
        notes: transNotes,
        location: transLoc,
      });
      setTransitionOpen(false);
      // reset form
      setHolderUsername('');
      setCaseId('');
      setTransNotes('');
      setTransLoc('');
      fetchAssets();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to transition asset');
    }
  };

  const handleDelete = async (pk: number) => {
    if (!window.confirm('Are you sure you want to delete this asset registry?')) return;
    try {
      await api.delete(`/assets/${pk}/`);
      fetchAssets();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete asset');
    }
  };

  const openTransition = (asset: Asset) => {
    setSelectedAsset(asset);
    setTransLoc(asset.location);
    setTransitionOpen(true);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'LAPTOP': return <Laptop size={18} />;
      case 'STORAGE': return <HardDrive size={18} />;
      case 'VEHICLE': return <Truck size={18} />;
      default: return <Shield size={18} />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Police & Forensic Assets"
        description="Monitor, assign, and manage custody lifecycle transitions for laptops, storage media, and investigative hardware."
        badge={
          <button className="btn btn-primary btn-sm" onClick={() => setRegisterOpen(true)}>
            <Plus size={12} /> Register Asset
          </button>
        }
      />

      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <div className="alert alert-red">{error}</div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Shield size={36} />}
          title="No assets registered"
          description="Use the button above to register forensic workstations, storage drives, and police assets."
        />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Name / Type</th>
                  <th>Serial Number</th>
                  <th>Current Holder</th>
                  <th>Case Assigned</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <span className="text-mono" style={{ fontWeight: 600 }}>{asset.asset_id}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--accent-hover)' }}>{getAssetIcon(asset.asset_type)}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{asset.asset_name}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{asset.asset_type}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-mono" style={{ fontSize: '0.75rem' }}>{asset.serial_number || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem' }}>
                        {asset.holder_username ? `👮 ${asset.holder_username}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem' }}>
                        {asset.case_id_str ? (
                          <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.case_title || ''}>
                            📂 {asset.case_id_str}
                          </div>
                        ) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{asset.location || '—'}</span>
                    </td>
                    <td>
                      <StatusBadge status={asset.status.toLowerCase()} label={asset.status} />
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem' }}
                          title="Transition Status"
                          onClick={() => openTransition(asset)}
                          disabled={asset.status === 'RETIRED'}
                        >
                          <RefreshCw size={12} style={{ marginRight: '0.25rem' }} /> Transition
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', color: '#ef4444' }}
                          title="Delete registry"
                          onClick={() => handleDelete(asset.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog: Register Asset */}
      {registerOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Register Police Asset</h3>
              <button className="modal-close" onClick={() => setRegisterOpen(false)}>×</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="text-label">Asset ID</label>
                  <input type="text" className="input" placeholder="e.g. POL-EQ-0003" value={newAssetId} onChange={(e) => setNewAssetId(e.target.value)} required />
                </div>
                <div>
                  <label className="text-label">Asset Type</label>
                  <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="LAPTOP">Forensic Laptop</option>
                    <option value="STORAGE">Encrypted Hard Drive / USB</option>
                    <option value="COMPUTER">Computer Workstation</option>
                    <option value="VEHICLE">Police Vehicle</option>
                    <option value="WEAPON">Service Weapon</option>
                    <option value="DOCUMENT_VAULT">Secure Document Vault</option>
                    <option value="OTHER">Other Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="text-label">Asset Name</label>
                  <input type="text" className="input" placeholder="e.g. Dell Latitude 5430" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-label">Serial Number</label>
                  <input type="text" className="input" placeholder="e.g. SN-88914A" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
                </div>
                <div>
                  <label className="text-label">Department / Unit</label>
                  <input type="text" className="input" placeholder="e.g. Cyber Cell Lab" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
                </div>
                <div>
                  <label className="text-label">Initial Location</label>
                  <input type="text" className="input" placeholder="e.g. Evidence Locker 2" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
                </div>
                <div>
                  <label className="text-label">Notes</label>
                  <textarea className="textarea" placeholder="Configuration, security holds..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRegisterOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: Transition Status */}
      {transitionOpen && selectedAsset && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Transition Custody: {selectedAsset.asset_id}</h3>
              <button className="modal-close" onClick={() => setTransitionOpen(false)}>×</button>
            </div>
            <form onSubmit={handleTransition}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="alert alert-blue" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
                  Current Status: <strong style={{ textTransform: 'uppercase' }}>{selectedAsset.status}</strong>
                  {selectedAsset.holder_username && ` (held by ${selectedAsset.holder_username})`}
                </div>
                <div>
                  <label className="text-label">Action / Transition State</label>
                  <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                    <option value="ASSIGN">Assign (to Officer & Case)</option>
                    <option value="TRANSFER">Transfer (to New Officer)</option>
                    <option value="MAINTENANCE">Maintenance (Service Lab)</option>
                    <option value="RETURN">Return (Release to Vault)</option>
                    <option value="RETIRE">Retire (Permanently Out of Service)</option>
                  </select>
                </div>
                
                {(action === 'ASSIGN' || action === 'TRANSFER') && (
                  <div>
                    <label className="text-label">Officer Username</label>
                    <input type="text" className="input" placeholder="e.g. investigator1" value={holderUsername} onChange={(e) => setHolderUsername(e.target.value)} required />
                  </div>
                )}

                {action === 'ASSIGN' && (
                  <div>
                    <label className="text-label">Case ID (Optional)</label>
                    <input type="text" className="input" placeholder="e.g. CASE-2026-CR-0891" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="text-label">New Location</label>
                  <input type="text" className="input" placeholder="e.g. Lab Desk 3" value={transLoc} onChange={(e) => setTransLoc(e.target.value)} />
                </div>
                <div>
                  <label className="text-label">Notes / Reasons</label>
                  <textarea className="textarea" placeholder="Log transition details, transfer receipts..." value={transNotes} onChange={(e) => setTransNotes(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTransitionOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Custody</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
