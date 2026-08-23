import React, { useState, useEffect } from 'react';
import {
  FileOutput, ShieldCheck, Download, ChevronRight,
  CheckCircle2, Package, FileText, AlertTriangle, Loader2,
} from 'lucide-react';
import { api, ensureArray } from '../services/api';
import { PageHeader } from './ui/PageHeader';
import { useConfetti } from '../hooks/useConfetti';

interface SelectedDoc {
  document_id: string;
  filename: string;
  sha256_hash: string;
  document_type: string;
  verified?: boolean;
  actual_hash?: string;
}

function getISTTimestamp() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
}

function generateVerificationId() {
  return 'VID-BSA-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

export const Section65BExport: React.FC = () => {
  const { fireConfetti } = useConfetti();

  // Step: 1=select, 2=verify, 3=generate
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cases, setCases] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<SelectedDoc[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifiedDocs, setVerifiedDocs] = useState<SelectedDoc[]>([]);
  const [generating, setGenerating] = useState(false);
  const [certId] = useState(generateVerificationId);
  const [timestamp] = useState(getISTTimestamp);
  const [officerName, setOfficerName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [cr, dr, me] = await Promise.all([
          api.get('/cases/'),
          api.get('/documents/'),
          api.get('/users/me/'),
        ]);
        const cs = ensureArray(cr.data);
        const ds = ensureArray(dr.data);
        setCases(cs);
        setDocuments(ds);
        if (cs.length) setSelectedCaseId((cs[0] as any).case_id);
        setOfficerName(me.data?.username || 'Officer');
      } catch { /* silent */ }
    }
    load();
  }, []);

  const caseDocs = documents.filter((d: any) => d.case_id === selectedCaseId);
  const currentCase = cases.find((c: any) => c.case_id === selectedCaseId);

  const toggleDoc = (d: any) => {
    const docId = d.document_id || d.id;
    setSelectedDocs(prev =>
      prev.find(x => x.document_id === docId)
        ? prev.filter(x => x.document_id !== docId)
        : [...prev, { document_id: docId, filename: d.filename || d.original_filename, sha256_hash: d.sha256_hash, document_type: d.document_type }]
    );
  };

  // Step 2: run real verify-integrity on each selected doc
  const handleVerify = async () => {
    setVerifying(true);
    const results: SelectedDoc[] = [];
    for (const doc of selectedDocs) {
      try {
        const res = await api.get(`/documents/${doc.document_id}/verify-integrity/`);
        results.push({ ...doc, verified: res.data.verified, actual_hash: res.data.actual_hash });
      } catch {
        results.push({ ...doc, verified: false });
      }
    }
    setVerifiedDocs(results);
    setVerifying(false);
    setStep(2);
  };

  // Step 3: generate and print PDF
  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 600));
    setStep(3);
    setGenerating(false);
    fireConfetti('export');
  };

  const handlePrint = () => {
    const docsHtml = verifiedDocs.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.filename}</td>
        <td>${d.document_type || 'Evidence'}</td>
        <td style="font-family:monospace;font-size:0.7em;word-break:break-all">${d.sha256_hash}</td>
        <td style="color:${d.verified ? '#16a34a' : '#dc2626'};font-weight:700">${d.verified ? '✓ VERIFIED' : '✗ FAILED'}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Section 65B Certificate — ${certId}</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px; color: #000; }
  h1 { text-align:center; font-size: 1.4em; border-bottom: 3px double #000; padding-bottom: 10px; }
  h2 { font-size: 1.1em; margin-top: 24px; }
  .cert-id { text-align:right; font-size: 0.85em; color: #555; }
  .section { margin: 16px 0; }
  table { width:100%; border-collapse: collapse; margin: 12px 0; font-size: 0.85em; }
  th, td { border: 1px solid #888; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  .declaration { border: 2px solid #000; padding: 14px; margin: 20px 0; font-size: 0.9em; line-height: 1.6; }
  .signature { margin-top: 40px; display:flex; justify-content:space-between; }
  .sig-block { text-align: center; width: 200px; border-top: 1px solid #000; padding-top: 6px; font-size: 0.85em; }
  .watermark { color:#ccc; font-size:72px; position:fixed; top:35%; left:20%; transform:rotate(-35deg); opacity:0.12; z-index:0; pointer-events:none; }
  @media print { .watermark { display:block; } }
</style>
</head>
<body>
<div class="watermark">SIH-26190 OFFICIAL</div>

<div class="cert-id">Certificate ID: <strong>${certId}</strong> | Generated: ${timestamp}</div>
<h1>🔏 CERTIFICATE UNDER SECTION 65B<br>BHARATIYA SAKSHYA ADHINIYAM, 2023<br><small style="font-size:0.7em">(formerly Indian Evidence Act, 1872)</small></h1>

<div class="section">
  <h2>1. Case Information</h2>
  <table>
    <tr><th>Case ID</th><td>${currentCase?.case_id || '—'}</td><th>Status</th><td>${currentCase?.status || '—'}</td></tr>
    <tr><th>Title</th><td colspan="3">${currentCase?.title || '—'}</td></tr>
    <tr><th>FIR Number</th><td>${currentCase?.fir_number || '—'}</td><th>Police Station</th><td>${currentCase?.police_station || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <h2>2. Digital Evidence — SHA-256 Integrity Verification</h2>
  <table>
    <thead><tr><th>#</th><th>Filename</th><th>Type</th><th>SHA-256 Hash</th><th>Status</th></tr></thead>
    <tbody>${docsHtml}</tbody>
  </table>
</div>

<div class="declaration">
  <strong>STATUTORY DECLARATION UNDER SECTION 65B, BHARATIYA SAKSHYA ADHINIYAM 2023</strong><br><br>
  I, <strong>${officerName}</strong>, do hereby certify that the electronic records listed in Section 2 above:<br><br>
  (a) were produced by a computer system or device forming part of the law enforcement network;<br>
  (b) the computer system was in regular use during the relevant period;<br>
  (c) the information was regularly fed into the computer in the ordinary course of activities;<br>
  (d) the computer system was operating properly at all material times;<br>
  (e) the electronic records produced are reproductions of the output of the said computer;<br>
  (f) SHA-256 cryptographic digests listed herein were computed from the original file bytes at the time of ingestion and verified at the time of certificate generation.<br><br>
  <strong>This certificate is issued in compliance with the Bharatiya Sakshya Adhiniyam 2023 and CERT-In Cybersecurity Guidelines.</strong>
</div>

<div class="signature">
  <div class="sig-block">
    ${officerName}<br>Certifying Officer<br>SIH-26190 Evidence Vault
  </div>
  <div class="sig-block">
    Date: ${timestamp}<br>
    Cert ID: ${certId}
  </div>
</div>

</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 400);
    }
  };

  return (
    <div>
      <PageHeader
        title="Section 65B Export"
        description="Generate a court-admissible digital evidence certificate with SHA-256 proofs under Bharatiya Sakshya Adhiniyam 2023."
        badge={<span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>BSA 2023 COMPLIANT</span>}
      />

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.8125rem', fontWeight: 700 }}>
        {[['1', 'Select', step >= 1], ['2', 'Verify Integrity', step >= 2], ['3', 'Generate PDF', step >= 3]].map(([num, label, active], i) => (
          <React.Fragment key={String(num)}>
            {i > 0 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
            <span style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{num}. {label}</span>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h3 className="text-subheading" style={{ marginBottom: '1rem' }}>1. Select Case & Evidence Documents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
          {/* Case selector */}
          <div>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Investigation Case</label>
            <select className="select" value={selectedCaseId} onChange={e => { setSelectedCaseId(e.target.value); setSelectedDocs([]); setStep(1); }}>
              {cases.map((c: any) => (
                <option key={c.case_id} value={c.case_id}>{c.case_id} — {c.title?.slice(0, 35)}</option>
              ))}
            </select>
            {currentCase && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{currentCase.case_id}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{currentCase.title}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.75rem' }}>Status: {currentCase.status}</div>
              </div>
            )}
          </div>

          {/* Document checkboxes */}
          <div>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Evidence Documents ({selectedDocs.length} selected)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
              {caseDocs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.5rem' }}>No documents found for this case.</div>
              ) : caseDocs.map((d: any) => {
                const docId = d.document_id || d.id;
                const isSelected = selectedDocs.some(x => x.document_id === docId);
                return (
                  <div
                    key={docId}
                    onClick={() => toggleDoc(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`, background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--surface-raised)', cursor: 'pointer' }}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ accentColor: 'var(--accent)' }} />
                    <FileText size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename || d.original_filename}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.document_type}</div>
                    </div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>SHA-256</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {step === 1 && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleVerify} disabled={verifying || selectedDocs.length === 0}>
              {verifying ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <ShieldCheck size={14} />}
              {verifying ? 'Verifying integrity…' : 'Verify Integrity & Proceed'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Verified */}
      {step >= 2 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', border: '1px solid rgba(35,134,54,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--green-text)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Cryptographic Integrity Verification Complete</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {verifiedDocs.filter(d => d.verified).length}/{verifiedDocs.length} documents passed SHA-256 verification
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {verifiedDocs.map(d => (
              <div key={d.document_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', fontSize: '0.8125rem' }}>
                {d.verified
                  ? <CheckCircle2 size={14} style={{ color: 'var(--green-text)', flexShrink: 0 }} />
                  : <AlertTriangle size={14} style={{ color: 'var(--red-text)', flexShrink: 0 }} />
                }
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{d.filename}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.sha256_hash?.slice(0, 12)}…</span>
                <span style={{ color: d.verified ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 700, fontSize: '0.75rem' }}>
                  {d.verified ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
          {step === 2 && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Package size={14} />}
                {generating ? 'Generating certificate…' : 'Generate Section 65B Certificate'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Download */}
      {step >= 3 && (
        <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--accent)', background: 'rgba(99,102,241,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileOutput size={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)' }}>{certId}.pdf</span>
                <span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>BSA 2023</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Generated: {timestamp} · {verifiedDocs.length} documents · Officer: {officerName}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handlePrint} style={{ gap: '0.5rem' }}>
              <Download size={14} /> Print / Download PDF
            </button>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'rgba(35,134,54,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(35,134,54,0.2)', fontSize: '0.8125rem', color: 'var(--green-text)', fontWeight: 600 }}>
            ✓ Certificate ID {certId} generated with statutory Section 65B declaration, SHA-256 proofs, and officer attestation block.
            Court-admissible under Bharatiya Sakshya Adhiniyam 2023.
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
