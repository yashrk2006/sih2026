# SIH26190 Local Qwen 2.5 3B Provider Integration Report

**Execution Timestamp**: `2026-08-22 01:42:30`  
**Detected Ollama Model**: `qwen2.5:3b` (1.9 GB)  
**Ollama Host API**: `http://127.0.0.1:11434`  
**Integration Status**: `VERIFIED & OPERATIONAL (100%)`

---

## 🏛️ 1. Installed Ollama Model Auto-Detection

Local Ollama query (`GET http://127.0.0.1:11434/api/tags`) returned:
```json
{
  "models": [
    { "name": "llama3.2:latest", "size": 2019393189 },
    { "name": "qwen2.5:3b", "size": 1929912432 }
  ]
}
```

### Backend Settings Update ([`backend/config/settings.py`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/backend/config/settings.py))
- `QWEN_ENABLED`: `True` by default.
- `QWEN_BASE_URL`: `http://127.0.0.1:11434`
- `QWEN_MODEL`: `qwen2.5:3b`

---

## 🛠️ 2. Dynamic Provider Status & Execution Logic

1. **Provider Status (`GET /api/ai/providers/`)**:
   - `get_ai_providers_status()` in [`apps/documents/intelligence.py`](file:///c:/Users/kushw/OneDrive/Desktop/antigravity/a%20sih-26190/sih26190/backend/apps/documents/intelligence.py) queries `/api/tags` on startup and runtime.
   - Detects `qwen2.5:3b` as installed and returns `available: true`.

2. **Provider Selection (`POST /api/ai/providers/select/`)**:
   - Selecting `qwen` updates `AI_PROVIDER = "qwen"`.

3. **3-Tier Document Intelligence Pipeline**:
   ```mermaid
   flowchart TD
       A[Document Upload & Text Extraction] --> B[Deterministic Baseline Extraction]
       B --> C{Active AI Provider?}
       C -- "qwen" --> D[Qwen 2.5 3B Enhancement via Ollama API]
       C -- "local" --> E[Baseline Extraction Output]
       D --> F[Merge & Validate Metadata]
       E --> F
       F --> G[Case Association]
       G --> H[SHA-256 Hashing]
       H --> I[AES-256 Fernet Encryption]
       I --> J[RSA-2048 Digital Signature]
       J --> K[Hardhat EVM Blockchain Anchor]
       K --> L[Audit Hash Chain Logging]
   ```

4. **Non-Blocking Fallback**:
   - If Ollama is offline or times out, `_try_qwen_extraction` logs a warning and falls back to Tier 1 deterministic extraction without throwing an exception or interrupting the security pipeline.

---

## 📊 3. Verification & Pipeline Results

Executing full ingestion test on `SIH26190_Synthetic_FIR_Test_Document.pdf` with `Qwen 2.5 3B` enabled:

| Step # | Operation | Status | Output / Details |
|---|---|---|---|
| 1 | **Upload** | ✅ PASS | File ingested cleanly |
| 2 | **Text Extraction / OCR** | ✅ PASS | `921` native characters extracted |
| 3 | **Qwen 2.5 3B Enhancement** | ✅ PASS | Executed model `qwen2.5:3b` via Ollama `/api/generate` |
| 4 | **Extracted Metadata** | ✅ PASS | FIR: `FIR-DEMO-2026-0001`<br>Persons: `['Ananya Sharma', 'Arjun Verma', 'Rohan Mehta']`<br>Organizations: `['Demo Industrial Services']`<br>Legal Sections: `['379 IPC', '420 IPC']`<br>Evidence IDs: `['EVID-DEMO-001', 'EVID-DEMO-002', 'EVID-DEMO-003']` |
| 5 | **Case Association** | ✅ PASS | Associated with `CASE-2026-CR-0001` |
| 6 | **SHA-256 Digest** | ✅ PASS | `1a2ba94446e1cd8aec2291d4cb095d60f2f55603b5e8223119622f173b94d803` |
| 7 | **AES-256 Disk Encryption** | ✅ PASS | Fernet storage & roundtrip decryption match |
| 8 | **RSA-2048 Signature** | ✅ PASS | `SIGNATURE_VALID` |
| 9 | **Blockchain Anchor** | ✅ PASS | Transaction `0x2bdd0a029d28c92040a25e20a233aa32e8ac56ca711096d2570f7a1d3cc1c97c` |
| 10 | **Audit Chain** | ✅ PASS | `Valid = True` |
| 11 | **Tampering Test** | ✅ PASS | **`TAMPERING_DETECTED`** |
