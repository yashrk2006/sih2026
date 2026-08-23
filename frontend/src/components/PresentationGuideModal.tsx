import React from 'react';
import { X, Play, ArrowRight } from 'lucide-react';

interface PresentationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const PresentationGuideModal: React.FC<PresentationGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  if (!isOpen) return null;

  const presentationSteps = [
    {
      minute: '0:00 - 0:45',
      title: '1. Login & Security Architecture Overview',
      tab: 'dashboard',
      action: 'Show Command Center operational dashboard, role badge, and 5 verified system health controls (AES-256, RSA-2048, EVM Blockchain, Audit Chain).',
    },
    {
      minute: '0:45 - 1:30',
      title: '2. Case Dossier Register',
      tab: 'cases',
      action: 'Open CASES tab. Click CASE-2026-CR-0001 to show case details & associated evidence documents.',
    },
    {
      minute: '1:30 - 2:30',
      title: '3. Real Document Ingestion & Extraction',
      tab: 'ingestion',
      action: 'Open INGESTION tab. Click "Load Synthetic FIR PDF Test File" and run the 6-stage real backend ingestion pipeline. Show extracted FIR Number, Persons, Legal Sections, and Evidence IDs.',
    },
    {
      minute: '2:30 - 3:30',
      title: '4. Integrity Verification & Blockchain Proof',
      tab: 'integrity',
      action: 'Open INTEGRITY & TAMPERING tab. Click "VERIFY DOCUMENT INTEGRITY". Show green "DOCUMENT INTEGRITY VERIFIED" banner, matching SHA-256 digests, RSA signature, and Hardhat EVM Transaction Hash.',
    },
    {
      minute: '3:30 - 4:30',
      title: '5. Live Tampering Demonstration (THE KEY DEMO)',
      tab: 'integrity',
      action: 'Click "EXECUTE LIVE TAMPERING TEST". Demonstrate that 1 modified byte triggers red "TAMPERING DETECTED" alert: SHA-256 Mismatch ✕, RSA Signature Invalid ✕, Blockchain Unanchored ✕.',
    },
    {
      minute: '4:30 - 5:00',
      title: '6. Immutable Audit Log & Security Controls',
      tab: 'audit',
      action: 'Open AUDIT LOG tab to display canonical JSON hash chain events and 0 tamper error log.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-md max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">5-Minute SIH Judge Presentation Script</h2>
              <p className="text-xs text-slate-400">Step-by-step presentation flow & instant tab navigation triggers for judges.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps List */}
        <div className="space-y-2">
          {presentationSteps.map((step, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.2 rounded border border-amber-900">
                    {step.minute}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100">{step.title}</h4>
                </div>
                <p className="text-xs text-slate-400">{step.action}</p>
              </div>

              <button
                onClick={() => {
                  onNavigateTab(step.tab);
                  onClose();
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 text-xs font-semibold shrink-0 flex items-center justify-center space-x-1"
              >
                <span>Jump to Tab</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
