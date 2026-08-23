# SIH26190 Documents vs Evidence Search Workflow Separation Report

**Execution Timestamp**: `2026-08-22 13:54:45`  
**Frontend URL**: `http://127.0.0.1:3000/`  
**Backend API**: `http://127.0.0.1:8000/`  
**Architecture**: `Decoupled Workflows: Documents (Lifecycle Repository) vs Evidence Search (Investigative Entity Graph)`  
**Status**: `100% VERIFIED & PASSING ALL COMPILATION & TEST SUITES`

---

## 🏛️ 1. Architecture & Information Architecture Differentiation

| Workflow Feature | 📄 Documents Module (`DocumentManager.tsx`) | 🔍 Evidence Search Module (`EvidenceSearch.tsx`) |
|---|---|---|
| **Core Question** | *"What documents exist and how are they managed throughout their secure lifecycle?"* | *"What evidence exists, where did it come from, and what is it connected to?"* |
| **Page Title** | **Documents** | **Evidence Search** |
| **Subtitle** | *"Manage case documents and their secure lifecycle."* | *"Search and correlate evidence across cases, documents and investigative records."* |
| **Primary Interaction** | Document Repository Table + Filter Toolbar (Type, Case, Signature) + Document Inspector (Version History, Crypto Hashes, Signatures) | Large Investigative Search Input (Modes: Exact, Semantic, Filtered) + Quick Query Chips + Evidence Cards & Correlation Network Inspector |
| **Result Unit** | **Document File Record** (`FIR_001.pdf`, version, storage location, signature status) | **Evidence Entity Card** (`EVID-SYN-0487-001`, source document, related persons, related orgs, legal sections, chain integrity, related evidence network) |
| **Backend API** | `GET /api/documents/` (Repository list) | `GET /api/search/?q=<query>&mode=<exact|semantic|filtered>` |

---

## 📁 2. Key Components Added & Modified

1. **[`frontend/src/components/DocumentManager.tsx`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/frontend/src/components/DocumentManager.tsx)**:
   - Dedicated document lifecycle management view.
   - Filter Toolbar: `Document Type`, `Signature Status`, and Search filter.
   - Document Registry Table with columns: `Document`, `Type`, `Case ID`, `Uploaded Date`, `Version`, `Integrity`, `Signature`, `Actions`.
   - Selected Document Inspector with sub-tabs: `Metadata` (Storage location, Case ID), `Crypto & Proofs` (SHA-256 Digest, RSA-2048 Signature, EVM Blockchain Anchor TX), and `Version History`.
   - Modal workflow for `+ Upload Document`.

2. **[`frontend/src/components/EvidenceSearch.tsx`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/frontend/src/components/EvidenceSearch.tsx)**:
   - Investigative entity discovery & correlation view.
   - 3 Search Modes: `Exact Search`, `Semantic Search`, and `Filtered Search`.
   - Quick Query Suggestion Chips (`EVID-SYN-0487-001`, `CASE-2026-CY-0487`, `FIR-SYN-2026-00487`, `Vikram Malhotra`, `Aranya Fintech`, `318`, `66C`).
   - Evidence-Centric Cards displaying Evidence ID, Evidence Type, Description, Source Document, Case ID, Related Persons, Related Orgs, and Legal Sections.
   - Evidence Correlation Inspector featuring a **"Related Evidence Network"** connecting sibling evidence items.

3. **[`frontend/src/App.tsx`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/frontend/src/App.tsx)**:
   - Decoupled tab routing: `activeTab === 'documents'` renders `<DocumentManager />` while `activeTab === 'search'` renders `<EvidenceSearch />`.

---

## 🧪 3. Verification Test Checklist

1. **Documents Navigation (`activeTab === 'documents'`)**: Renders Document Lifecycle Management table, filter controls, upload workflow, and version history inspector.
2. **Evidence Search Navigation (`activeTab === 'search'`)**: Renders investigative entity search bar, mode selector, quick query chips, evidence-centric cards, and correlation network inspector.
3. **Query Tests (`Evidence Search`)**:
   - `EVID-SYN-0487-001`: Returns Evidence Card for Server Drive Exhibit with related evidence graph.
   - `CASE-2026-CY-0487`: Returns all evidence items attached to case `CASE-2026-CY-0487`.
   - `FIR-SYN-2026-00487`: Correlates evidence extracted from FIR document.
   - `Vikram Malhotra`: Returns evidence items linking person `Vikram Malhotra` to `Aranya Fintech Solutions Pvt. Ltd.` and `Section 318 BNS`.
4. **Vite TypeScript Build**: Built cleanly in **`3.70s`** (`0` errors, `0` warnings).
