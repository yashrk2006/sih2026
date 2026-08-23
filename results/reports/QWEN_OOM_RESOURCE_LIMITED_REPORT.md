# SIH26190 AI Provider Health & Resource-Limited (OOM) Fallback Report

**Execution Timestamp**: `2026-08-22 01:53:10`  
**Ollama Model**: `qwen2.5:3b` (1.9 GB installed)  
**Ollama API**: `http://127.0.0.1:11434`  
**Execution Status**: `VERIFIED & OPERATIONAL (100%)`

---

## 🔍 1. Provider Status Classification Architecture

The backend provider status API (`GET /api/ai/providers/`) now performs a two-tier health probe to accurately distinguish model installation from operational availability:

1. **Installed Probe**:
   - Queries `GET http://127.0.0.1:11434/api/tags`.
   - Returns `installed: true` if `qwen2.5:3b` exists in the local Ollama repository.

2. **Usability / Health Probe**:
   - Performs a lightweight generation test query to `POST http://127.0.0.1:11434/api/generate`.
   - If Ollama returns HTTP 500 (`llama-server reported out-of-memory during startup` / `failed to allocate buffer`), the backend classifies Qwen 3B as:
     - `installed: true`
     - `available: false`
     - `status_code: "INSTALLED_RESOURCE_LIMITED"`
     - `status_message: "Installed (qwen2.5:3b) but resource limited (insufficient memory / OOM)"`

---

## 🛡️ 2. Provider Selection Enforcement (`POST /api/ai/providers/select/`)

- Attempting to set `qwen` as active provider while resource-limited returns **HTTP 400 Bad Request**:
  `"error": "Cannot select Qwen 3B: Installed (qwen2.5:3b) but resource limited (insufficient memory / OOM). Active provider remains Local Processing."`
- The system automatically forces `selected: "local"` to prevent runtime failures.

---

## 🎨 3. Frontend UI Badge Representation ([`AISettingsPanel.tsx`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/frontend/src/components/AISettingsPanel.tsx))

| Provider | Installed | Available | UI Badge Status | Status Note |
|---|---|---|---|---|
| **Local Processing** | `true` | `true` | `🟢 AVAILABLE` | Deterministic baseline (always active) |
| **Qwen 3B** | `true` | `false` | `🟡 INSTALLED / RESOURCE LIMITED` | Installed (`qwen2.5:3b`) but resource limited (insufficient memory / OOM) |
| **Gemini** | `false` | `false` | `⚪ OPTIONAL / OFFLINE` | API Key not configured |

---

## 📊 4. Fallback Verification Test Matrix

Full real-document pipeline test executed on `SIH26190_Synthetic_FIR_Test_Document.pdf` under Qwen 3B resource fallback:

| Step # | Operation | Security Guarantee | Result |
|---|---|---|---|
| 1 | **Upload** | Single File Upload | ✅ PASS |
| 2 | **Text Extraction / OCR** | Native Text Reading | ✅ PASS (`921` chars) |
| 3 | **Intelligence Pipeline** | Resource-Limited Fallback | ✅ PASS (`local_fallback`) |
| 4 | **Entity Extraction** | Deterministic Pattern Extraction | ✅ PASS (FIR, 3 Persons, 1 Org, 2 Sections, 3 Evidence IDs) |
| 5 | **Case Association** | Case Matching | ✅ PASS (`CASE-2026-CR-0001`) |
| 6 | **SHA-256 Digest** | Cryptographic Hash | ✅ PASS (`1a2ba94446e1cd8a...`) |
| 7 | **AES-256 Disk Encryption** | Fernet Confidentiality | ✅ PASS (Match) |
| 8 | **RSA-2048 Digital Signature** | PSS Non-Repudiation | ✅ PASS (`SIGNATURE_VALID`) |
| 9 | **Local Blockchain Anchor** | Hardhat EVM Node (8545) | ✅ PASS (`0xaed87b9665319ac5...`) |
| 10 | **Blockchain Verification** | Cryptographic Ledger Check | ✅ PASS (`BLOCKCHAIN_ANCHORED`) |
| 11 | **Audit Hash Chain** | Canonical Event Linkage | ✅ PASS (`Valid = True`) |
| 12 | **Tampering Test** | Live Byte Modification | ✅ PASS (`TAMPERING_DETECTED`) |
