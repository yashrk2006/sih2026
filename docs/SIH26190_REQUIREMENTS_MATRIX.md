# CASEVAULT — SIH26190 REQUIREMENTS MATRIX

This matrix maps every official requirement of the **SIH26190 Problem Statement** (Secure Digital Document Management System) to its implementation details in CaseVault.

---

| # | Requirement | Implementation Details | File / Module | API Endpoint | UI Component | Test File | Status |
|---|---|---|---|---|---|---|---|
| **1** | Centralized Storage | Encrypted storage on filesystem referenced by UUID database entries. | `backend/apps/documents/` | `GET /api/documents/` | `DocumentManager.tsx` | `test_documents.py` | **PASS** |
| **2** | Digitization | Upload and process files, extracting text content dynamically. | `backend/apps/documents/` | `POST /api/documents/upload/` | `IngestionStudio.tsx` | `test_ocr.py` | **PASS** |
| **3** | OCR Processing | Scanned documents processed using Tesseract OCR fallback. | `backend/apps/documents/ocr.py` | `POST /api/documents/upload/` | `IngestionStudio.tsx` | `test_ocr.py` | **PASS** |
| **4** | Confidentiality | AES-256 Fernet encryption of all evidence and legal files. | `backend/apps/security/` | Server-side decryption stream | `DocumentManager.tsx` | `test_security_and_crypto.py` | **PASS** |
| **5** | Secure Access | Fine-grained object-level access rules via custom Django permissions. | `backend/apps/users/permissions.py` | All request views | `LoginModal.tsx` | `test_rbac.py` | **PASS** |
| **6** | Unauthorized Modification Prevention | Enforces read-only database structures and strict role checking. | `backend/apps/documents/views.py` | All POST/PUT views | `DocumentManager.tsx` | `test_rbac.py` | **PASS** |
| **7** | Document Integrity | SHA-256 hash comparison between stored value and current pre-encryption bytes. | `backend/apps/documents/views.py` | `GET /api/documents/{id}/verify-integrity/` | `IntegrityVerification.tsx` | `test_integrity.py` | **PASS** |
| **8** | Version Control | Immutable `DocumentVersion` linked list chain allowing old version access. | `backend/apps/documents/models.py` | `GET /api/documents/{id}/versions/` | `DocumentManager.tsx` | `test_documents.py` | **PASS** |
| **9** | Audit Trail | Tamper-evident hash-chained AuditEvent chain verification. | `backend/apps/audit/` | `GET /api/audit/verify/` | `AuditTimeline.tsx` | `test_audit_trail.py` | **PASS** |
| **10** | Search & Retrieval | Permission-aware keyword, metadata, and filters search engine. | `backend/apps/search/` | `GET /api/documents/search/` | `EvidenceSearch.tsx` | `test_search.py` | **PASS** |
| **11** | Collaboration | Assigning and revoking case dossier access permissions to investigators and legal officers with creator checks. | `backend/apps/cases/views.py` | `POST/DELETE /api/cases/{id}/share/` | `CaseManagement.tsx` | `test_sih_hardened.py` | **FULLY IMPLEMENTED** |
| **12** | Compliance Support | Visual compliance dashboard verifying 7 cryptographic/operational controls & active legal hold locks. | `backend/apps/documents/views.py` | `GET /api/compliance/` | `ComplianceDashboard.tsx` | `test_sih_hardened.py` | **FULLY IMPLEMENTED** |
| **13** | Evidentiary Integrity | Verification page validating hash, signatures, blockchain, and custody. | `backend/apps/documents/views.py` | Multiple endpoints | `IntegrityVerification.tsx` | `test_integrity.py` | **PASS** |
| **14** | AI Intelligence | Named Entity Extraction (NER) using spaCy, regex, and Gemini. | `backend/apps/documents/intelligence.py` | `GET /api/ai/providers/` | `AISettingsPanel.tsx` | `test_ai.py` | **PASS** |
| **15** | Digital Signatures | RSA-2048 PSS key signature with verified-status indicator. | `backend/apps/security/signatures.py` | `POST /api/documents/{id}/sign/` | `DigitalSignatures.tsx` | `test_signatures.py` | **PASS** |
| **16** | Blockchain Trust Layer | Anchoring evidence pre-encryption hashes to EVM Solidity contract. | `backend/apps/blockchain/` | `GET /api/documents/{id}/blockchain-proof/` | `BlockchainRecords.tsx` | `test_blockchain.py` | **PASS** |
| **17** | Case Management | Criminal/Civil case dossiers linked to assigned users. | `backend/apps/cases/` | `GET /api/cases/` | `CaseManagement.tsx` | `test_case_association.py` | **PASS** |
| **18** | Role-Based Access | Django permissions enforcing ADMIN, INVESTIGATOR, LEGAL, AUDITOR. | `backend/apps/users/permissions.py` | Permission decorators | `Navbar.tsx` | `test_rbac.py` | **PASS** |
| **19** | Police Asset Lifecycle | Asset assignment, transition logs, location updates, and audit trail records. | `backend/apps/assets/` | `GET/POST /api/assets/` | `PoliceAssets.tsx` | `test_sih_hardened.py` | **FULLY IMPLEMENTED** |
