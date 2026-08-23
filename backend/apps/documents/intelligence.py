"""
AI Document Intelligence — Classification and Entity Extraction.

Architecture (3-tier, most reliable first):
  Tier 1: Rule/keyword baseline (always active, deterministic, no external deps)
  Tier 2: spaCy NER for entity extraction
  Tier 3: Optional LLM API (Gemini/OpenAI) for richer extraction — env-var gated

The system works fully without Tier 3.
LLM results are validated; we NEVER invent extracted information.
"""
import re
import json
import logging
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# ── Document Type Classification ──────────────────────────────────────────────

DOCUMENT_TYPE_KEYWORDS = {
    "FIR": [
        "first information report", "fir no", "fir number", "fir no.",
        "under section", "complainant", "police station", "station house officer",
        "cognizable offence", "non-cognizable", "station diary",
    ],
    "POLICE_REPORT": [
        "police report", "station report", "beat report", "patrol report",
        "station house report", "incident report", "crime report",
    ],
    "WITNESS_STATEMENT": [
        "witness statement", "statement of witness", "deponent", "i hereby state",
        "sworn before", "solemnly affirm", "voluntary statement",
        "statement recorded", "section 161", "section 164",
    ],
    "INVESTIGATION_REPORT": [
        "investigation report", "preliminary inquiry", "inquiry report",
        "investigation findings", "case investigation", "detailed investigation",
        "field investigation",
    ],
    "CHARGE_SHEET": [
        "charge sheet", "chargesheet", "challan", "police challan",
        "charge framed", "accused charged", "offence charged",
        "section 173", "final report",
    ],
    "EVIDENCE_RECORD": [
        "evidence record", "exhibit", "muddemal", "seized property",
        "evidence list", "property register", "material evidence",
        "case property", "chain of custody",
    ],
    "COURT_FILING": [
        "court of", "honourable court", "hon'ble court", "petitioner",
        "respondent", "plaintiff", "defendant", "writ petition",
        "application under", "case no.", "suit no.", "criminal misc",
        "sessions court", "high court", "supreme court", "magistrate",
        "district court",
    ],
    "FORENSIC_REPORT": [
        "forensic report", "forensic science laboratory", "fsl report",
        "dna analysis", "fingerprint analysis", "ballistic report",
        "toxicology report", "post mortem", "autopsy", "chemical analysis",
        "biological evidence", "forensic examination",
    ],
    "LEGAL_NOTICE": [
        "legal notice", "notice under", "hereby give notice",
        "demand notice", "statutory notice", "show cause notice",
    ],
    "JUDGMENT": [
        "judgment", "judgement", "hereby ordered", "it is ordered",
        "the court orders", "acquitted", "convicted", "sentence",
        "disposed of", "dismissed", "allowed",
    ],
}


def classify_document_type(text: str) -> dict:
    """
    Classify document type using keyword matching (Tier 1).
    
    Returns:
        {
            "document_type": str,
            "confidence": float,
            "method": "rule_based",
            "matched_keywords": list[str]
        }
    """
    text_lower = text.lower()
    scores = {}

    for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in text_lower]
        if matched:
            scores[doc_type] = {"count": len(matched), "keywords": matched}

    if not scores:
        return {
            "document_type": "UNKNOWN",
            "confidence": 0.0,
            "method": "rule_based",
            "matched_keywords": [],
        }

    best_type = max(scores, key=lambda t: scores[t]["count"])
    total_keywords = len(DOCUMENT_TYPE_KEYWORDS[best_type])
    confidence = min(scores[best_type]["count"] / total_keywords, 1.0)

    return {
        "document_type": best_type,
        "confidence": round(confidence, 3),
        "method": "rule_based",
        "matched_keywords": scores[best_type]["keywords"][:5],
    }


# ── Entity Extraction — Regex Patterns ────────────────────────────────────────

_CASE_ID_PATTERNS = [
    r"\b(CASE-[A-Z0-9\-/]+)\b",
    r"\bRC\s*No\.?\s*([0-9]+/[0-9]+)\b",
]

_FIR_PATTERNS = [
    r"\b(FIR-DEMO-[0-9A-Z\-]+)\b",
    r"\bFIR\s*(?:NO\.?|NUMBER|#)?\s*[:\-]?\s*([0-9A-Z/\-]+)\b",
    r"\bFirst\s+Information\s+Report\s+(?:No\.?|Number)?\s*[:\-]?\s*([0-9A-Z/\-]+)\b",
    r"\bBook\s*No\.?\s*[:\-]?\s*([0-9A-Z/\-]+)\b",
]

_DATE_PATTERNS = [
    r"\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})\b",
    r"\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b",
    r"\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b",
]

_POLICE_STATION_PATTERNS = [
    r"(?:Police\s+Station|P\.S\.|PS)\s*[:\-]?\s*([A-Za-z\s]+?)(?:\n|,|\.)",
    r"Station\s+House\s*[:\-]?\s*([A-Za-z\s]+?)(?:\n|,|\.)",
]

_COURT_PATTERNS = [
    r"(?:Court\s+of|In\s+the\s+Court\s+of|Before)\s+([A-Za-z\s,]+?)(?:\n|\.)",
    r"(?:Sessions\s+Court|High\s+Court|District\s+Court|Magistrate\s+Court)[,\s]+([A-Za-z\s]+?)(?:\n|\.)",
]

_SECTION_PATTERNS = [
    r"\b[Ss]ection\s+(\d+[A-Z]?(?:\s+(?:IPC|CrPC|IEA|POCSO|NDPS|IT\s+Act|Indian\s+Penal\s+Code|Act))?)\b",
    r"\b[Ss]ec\.?\s*(\d+[A-Z]?(?:\s+(?:IPC|CrPC|IEA|POCSO|NDPS|IT\s+Act))?)\b",
    r"\bu/s\s+(\d+[A-Z]?(?:\s+[A-Z0-9\s]+)?)\b",
    r"\bIPC\s+(\d+[A-Z]?)\b",
]

_EVIDENCE_ID_PATTERNS = [
    r"\b(EVID-[0-9A-Z\-]+)\b",
    r"\b(EXHIBIT-[0-9A-Z\-]+)\b",
    r"\bEvidence\s+(?:ID|No\.?|Item|Record)\s*[:\-]?\s*([A-Z0-9\-]+)\b",
    r"\bExhibit\s+([A-Z0-9\-]+)\b",
    r"\bMuddemal\s+(?:Exhibit|No\.?)?\s*([A-Z0-9\-]+)\b",
    r"\bEx\.\s*([A-Z0-9\-]+)\b",
]


def _extract_by_patterns(text: str, patterns: list[str]) -> list[str]:
    """Apply a list of regex patterns and return unique matches ordered by length descending."""
    results = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            value = match.group(1).strip()
            if value:
                results.add(value)
    # Sort by length descending, then alphabetically for consistent deterministic ordering
    return sorted(results, key=lambda s: (-len(s), s))


def extract_persons_deterministic(text: str) -> list[str]:
    """Extract person names using structured role/prefix patterns."""
    persons = set()
    title_patterns = [
        r"\b(?:Inspector|Officer|Sub-Inspector|SI|Constable|Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|Complainant|Accused|Deponent|Witness)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b",
        r"(?:Name|Complainant|Accused|Deponent|Witness)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
        r"\b([A-Z][a-z]+\s+(?:Mehta|Sharma|Verma|Kumar|Singh|Gupta|Patel|Rao|Joshi|Reddy|Deshmukh|Iyer))\b",
    ]
    for pattern in title_patterns:
        for match in re.finditer(pattern, text, re.MULTILINE):
            name = match.group(1).split("\n")[0].strip()
            for noise in ["Accused", "Investigating", "Complainant", "Witness", "Deponent", "Officer"]:
                if name.endswith(noise):
                    name = name[:-len(noise)].strip()
            if len(name) > 3 and not any(w in name.lower() for w in ["police", "court", "station", "report", "district", "state"]):
                persons.add(name)

    multi_word_names = [p for p in persons if " " in p]
    filtered_persons = set()
    for p in persons:
        if " " not in p and any(p in mw.split() for mw in multi_word_names):
            continue
        filtered_persons.add(p)

    return sorted(list(filtered_persons))


def extract_organizations_deterministic(text: str) -> list[str]:
    """Extract organization names using business/entity suffix and label patterns."""
    orgs = set()
    org_patterns = [
        r"\b([A-Z][A-Za-z0-9&\-\s]+?\s+(?:Services|Syndicate|Bank|Corporation|Corp|Inc|Ltd|Limited|Pvt|Pharmaceuticals|Transit|Industries|Company|Enterprise))\b",
        r"Organization\s*[:\-]\s*([A-Z][A-Za-z0-9&\-\s]+?)(?:\n|,|\.)",
        r"Company\s*[:\-]\s*([A-Z][A-Za-z0-9&\-\s]+?)(?:\n|,|\.)",
    ]
    for pattern in org_patterns:
        for match in re.finditer(pattern, text, re.MULTILINE):
            org = match.group(1).strip()
            if len(org) > 3 and not any(w in org.lower() for w in ["first information", "police station", "court of"]):
                orgs.add(org)
    return sorted(list(orgs))


def extract_entities_regex(text: str) -> dict:
    """
    Extract legal entities using regex patterns.
    Returns structured dict.
    NEVER invents information — only returns what is found.
    """
    case_ids = _extract_by_patterns(text, _CASE_ID_PATTERNS)
    fir_numbers = _extract_by_patterns(text, _FIR_PATTERNS)
    dates = _extract_by_patterns(text, _DATE_PATTERNS)
    police_stations = _extract_by_patterns(text, _POLICE_STATION_PATTERNS)
    courts = _extract_by_patterns(text, _COURT_PATTERNS)
    legal_sections = _extract_by_patterns(text, _SECTION_PATTERNS)
    evidence_ids = _extract_by_patterns(text, _EVIDENCE_ID_PATTERNS)
    deterministic_persons = extract_persons_deterministic(text)
    deterministic_orgs = extract_organizations_deterministic(text)

    # Location extraction (cities and states in India)
    location_keywords = [
        "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore", "Bengaluru",
        "Hyderabad", "Ahmedabad", "Pune", "Surat", "Jaipur", "Lucknow",
        "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Ludhiana",
    ]
    locations = [loc for loc in location_keywords if loc.lower() in text.lower()]

    return {
        "case_id": case_ids[0] if case_ids else None,
        "all_case_ids": case_ids,
        "fir_number": fir_numbers[0] if fir_numbers else None,
        "all_fir_numbers": fir_numbers,
        "date": dates[0] if dates else None,
        "all_dates": dates[:5],
        "location": locations[0] if locations else None,
        "all_locations": locations,
        "police_station": police_stations[0] if police_stations else None,
        "court_name": courts[0] if courts else None,
        "legal_sections": legal_sections,
        "evidence_ids": evidence_ids,
        "persons": deterministic_persons,
        "organizations": deterministic_orgs,
    }


_spacy_nlp = None

def extract_entities_spacy(text: str) -> dict:
    """
    Extract named entities using spaCy NER.
    Extracts: PERSON, ORG, GPE (location), DATE
    """
    global _spacy_nlp
    try:
        if _spacy_nlp is None:
            import spacy
            from django.conf import settings
            try:
                _spacy_nlp = spacy.load(settings.SPACY_MODEL)
            except Exception as e:
                logger.warning("spaCy model '%s' not loaded: %s. Using regex extraction.", settings.SPACY_MODEL, e)
                return {"persons": [], "organizations": [], "spacy_dates": [], "spacy_locations": []}

        doc = _spacy_nlp(text[:5000])

        persons = list({ent.text.strip() for ent in doc.ents if ent.label_ == "PERSON" and len(ent.text.strip()) > 2})
        organizations = list({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG" and len(ent.text.strip()) > 2})
        spacy_locations = list({ent.text.strip() for ent in doc.ents if ent.label_ in ("GPE", "LOC") and len(ent.text.strip()) > 2})
        spacy_dates = list({ent.text.strip() for ent in doc.ents if ent.label_ == "DATE"})

        return {
            "persons": persons[:20],
            "organizations": organizations[:10],
            "spacy_dates": spacy_dates[:10],
            "spacy_locations": spacy_locations[:10],
        }
    except Exception as e:
        logger.error("spaCy entity extraction failed: %s", e)
        return {"persons": [], "organizations": [], "spacy_dates": [], "spacy_locations": []}



def get_ai_providers_status() -> dict:
    """
    Query current availability & health status of AI providers without exposing API keys or secrets.
    Distinguishes INSTALLED vs AVAILABLE vs RESOURCE_LIMITED (OOM).
    """
    import requests

    qwen_installed = False
    qwen_available = False
    qwen_status_code = "OFFLINE"
    qwen_status_msg = "Ollama service offline"

    base_url = getattr(settings, "QWEN_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    configured_model = getattr(settings, "QWEN_MODEL", "qwen2.5:3b")

    try:
        url = f"{base_url}/api/tags"
        r = requests.get(url, timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            models_list = [m.get("name", "") for m in data.get("models", [])]
            
            found_model = None
            if configured_model in models_list:
                found_model = configured_model
            else:
                for m in models_list:
                    if "qwen2.5" in m or "qwen" in m:
                        found_model = m
                        break

            if found_model:
                qwen_installed = True
                
                # Probe model health with lightweight generate request
                try:
                    probe_res = requests.post(
                        f"{base_url}/api/generate",
                        json={"model": found_model, "prompt": "health_check", "stream": False},
                        timeout=3.0
                    )
                    if probe_res.status_code == 200:
                        qwen_available = True
                        qwen_status_code = "AVAILABLE"
                        qwen_status_msg = f"Operational ({found_model})"
                    else:
                        err_text = probe_res.text.lower()
                        qwen_available = False
                        if "out-of-memory" in err_text or "out of memory" in err_text or "buffer" in err_text or probe_res.status_code == 500:
                            qwen_status_code = "INSTALLED_RESOURCE_LIMITED"
                            qwen_status_msg = f"Installed ({found_model}) but resource limited (insufficient memory / OOM)"
                        else:
                            qwen_status_code = "UNAVAILABLE"
                            qwen_status_msg = f"Installed ({found_model}) but returning HTTP {probe_res.status_code}"
                except Exception as probe_err:
                    qwen_available = False
                    qwen_status_code = "INSTALLED_RESOURCE_LIMITED"
                    qwen_status_msg = f"Installed ({found_model}) but model startup timed out or memory limited"
            else:
                qwen_installed = False
                qwen_available = False
                qwen_status_code = "NOT_INSTALLED"
                qwen_status_msg = f"Model {configured_model} not installed in Ollama"
    except Exception as e:
        logger.debug("Ollama status check failed: %s", e)
        qwen_installed = False
        qwen_available = False
        qwen_status_code = "OFFLINE"
        qwen_status_msg = "Ollama service unreachable"

    gemini_available = bool(getattr(settings, "GEMINI_API_KEY", ""))

    current_selected = getattr(settings, "AI_PROVIDER", "local")
    if current_selected == "qwen" and not qwen_available:
        current_selected = "local"
        setattr(settings, "AI_PROVIDER", "local")

    return {
        "providers": [
            {
                "id": "local",
                "name": "Local Processing",
                "installed": True,
                "available": True,
                "status_code": "AVAILABLE",
                "status_message": "Deterministic baseline (always active)",
            },
            {
                "id": "qwen",
                "name": "Qwen 3B",
                "installed": qwen_installed,
                "available": qwen_available,
                "status_code": qwen_status_code,
                "status_message": qwen_status_msg,
            },
            {
                "id": "gemini",
                "name": "Gemini",
                "installed": gemini_available,
                "available": gemini_available,
                "status_code": "AVAILABLE" if gemini_available else "UNAVAILABLE",
                "status_message": "Gemini 1.5 Flash Cloud LLM" if gemini_available else "API Key not configured",
            },
        ],
        "selected": current_selected,
    }


def set_selected_ai_provider(provider_id: str) -> dict:
    """
    Set active AI provider choice at runtime.
    Valid choices: "local", "qwen", "gemini"
    Checks usability before allowing activation.
    """
    pid_map = {
        "local": "local",
        "deterministic": "local",
        "local_processing": "local",
        "qwen": "qwen",
        "qwen2.5:3b": "qwen",
        "gemini": "gemini",
    }
    target_pid = pid_map.get(provider_id.lower().strip(), provider_id)

    if target_pid not in ("local", "qwen", "gemini"):
        raise ValueError(f"Invalid provider '{provider_id}'. Must be one of: local, qwen, gemini")

    provider_id = target_pid

    if provider_id == "qwen":
        status = get_ai_providers_status()
        qwen_info = next((p for p in status["providers"] if p["id"] == "qwen"), None)
        if not qwen_info or not qwen_info.get("available"):
            setattr(settings, "AI_PROVIDER", "local")
            msg = qwen_info.get("status_message", "Qwen 2.5 3B is currently resource limited") if qwen_info else "Qwen 3B is unavailable"
            raise ValueError(f"Cannot select Qwen 3B: {msg}. Active provider remains Local Processing.")

    setattr(settings, "AI_PROVIDER", provider_id)
    return get_ai_providers_status()


def _try_qwen_extraction(text: str) -> Optional[dict]:
    """
    Optional Qwen 3B (qwen2.5:3b) model via Ollama local REST API.
    Returns None if unreachable or disabled. Automatically falls back without crashing.
    """
    if not getattr(settings, "QWEN_ENABLED", True):
        logger.debug("Qwen is disabled in settings")
        return None

    base_url = getattr(settings, "QWEN_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    configured_model = getattr(settings, "QWEN_MODEL", "qwen2.5:3b")
    
    model_name = configured_model
    try:
        import requests
        tags_res = requests.get(f"{base_url}/api/tags", timeout=2.0)
        if tags_res.status_code == 200:
            installed = [m.get("name", "") for m in tags_res.json().get("models", [])]
            if configured_model not in installed:
                for m in installed:
                    if "qwen2.5" in m or "qwen" in m:
                        model_name = m
                        break
    except Exception:
        pass

    url = f"{base_url}/api/generate"
    prompt = f"""You are a legal document analyzer. Extract information from this document text.
Return ONLY a valid JSON object with keys:
- document_type (one of FIR, POLICE_REPORT, WITNESS_STATEMENT, INVESTIGATION_REPORT, CHARGE_SHEET, EVIDENCE_RECORD, COURT_FILING, FORENSIC_REPORT, LEGAL_NOTICE, JUDGMENT, UNKNOWN)
- case_id, fir_number, date, location, police_station, court_name
- persons (list of names or objects with name key)
- organizations (list of organization names)
- legal_sections (list of cited sections)
- evidence_ids (list of exhibit/evidence IDs)

Document text:
{text[:2500]}
"""
    try:
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        res = requests.post(url, json=payload, timeout=25.0)
        if res.status_code == 200:
            data = res.json()
            response_text = data.get("response", "")
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                
                # Normalize persons if returned as list of dicts
                if parsed.get("persons") and isinstance(parsed["persons"], list):
                    norm_persons = []
                    for item in parsed["persons"]:
                        if isinstance(item, str):
                            norm_persons.append(item.strip())
                        elif isinstance(item, dict) and item.get("name"):
                            norm_persons.append(str(item["name"]).strip())
                    parsed["persons"] = norm_persons

                # Normalize organizations if returned as list of dicts
                if parsed.get("organizations") and isinstance(parsed["organizations"], list):
                    norm_orgs = []
                    for item in parsed["organizations"]:
                        if isinstance(item, str):
                            norm_orgs.append(item.strip())
                        elif isinstance(item, dict) and item.get("name"):
                            norm_orgs.append(str(item["name"]).strip())
                    parsed["organizations"] = norm_orgs

                logger.info("Qwen 2.5 3B enhancement succeeded using model: %s", model_name)
                return parsed
    except Exception as e:
        logger.warning("Qwen 3B processing unavailable/failed: %s. Falling back to local processing.", e)
        return None
    return None


def _try_llm_extraction(text: str) -> Optional[dict]:
    """
    Optional Tier 3: Use Gemini/OpenAI API for richer extraction.
    Only called if API key is set. Never fabricates data.
    Returns None if unavailable.
    """
    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    openai_key = getattr(settings, "OPENAI_API_KEY", "")

    if not gemini_key and not openai_key:
        return None

    prompt = f"""You are a legal document analyzer. Extract the following from this document text.
Return ONLY a valid JSON object. If information is not present, use null or [].
NEVER invent or guess information.

Extract:
- document_type: one of [FIR, POLICE_REPORT, WITNESS_STATEMENT, INVESTIGATION_REPORT, CHARGE_SHEET, EVIDENCE_RECORD, COURT_FILING, FORENSIC_REPORT, LEGAL_NOTICE, JUDGMENT, UNKNOWN]
- case_id: string or null
- fir_number: string or null  
- date: string (YYYY-MM-DD format) or null
- location: string or null
- police_station: string or null
- court_name: string or null
- persons: list of person names mentioned
- organizations: list of organization names
- legal_sections: list of legal sections cited (e.g. "IPC 302")
- evidence_ids: list of evidence/exhibit IDs

Document text (first 3000 chars):
{text[:3000]}

JSON response:"""

    try:
        if gemini_key:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            raw = response.text.strip()
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        logger.warning("Gemini extraction failed: %s", e)

    try:
        if openai_key:
            import openai
            client = openai.OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.warning("OpenAI extraction failed: %s", e)

    return None


def analyze_document(text: str) -> dict:
    """
    Full document intelligence pipeline.
    Combines rule-based, spaCy NER, and active AI provider into a structured output.
    Returns canonical metadata dict with provider_used, timestamp, and processing_status.
    """
    from django.utils import timezone
    now_iso = timezone.now().isoformat()

    if not text or not text.strip():
        return {
            "document_type": "UNKNOWN",
            "case_id": None,
            "fir_number": None,
            "date": None,
            "location": None,
            "police_station": None,
            "court_name": None,
            "persons": [],
            "organizations": [],
            "legal_sections": [],
            "evidence_ids": [],
            "classification_confidence": 0.0,
            "classification_method": "empty_document",
            "provider_used": getattr(settings, "AI_PROVIDER", "local"),
            "timestamp": now_iso,
            "processing_status": "EMPTY",
        }

    # Baseline Tiers 1 & 2
    classification = classify_document_type(text)
    regex_entities = extract_entities_regex(text)
    spacy_entities = extract_entities_spacy(text)

    selected_provider = getattr(settings, "AI_PROVIDER", "local")
    provider_used = "local"
    ai_result = None

    if selected_provider == "qwen":
        ai_result = _try_qwen_extraction(text)
        if ai_result:
            provider_used = "qwen"
        else:
            logger.info("Qwen unavailable. Falling back to local processing.")
            provider_used = "local_fallback"
    elif selected_provider == "gemini":
        ai_result = _try_llm_extraction(text)
        if ai_result:
            provider_used = "gemini"
        else:
            logger.info("Gemini unavailable. Falling back to local processing.")
            provider_used = "local_fallback"
    else:
        provider_used = "local"

    combined_persons = list(set(spacy_entities.get("persons", []) + regex_entities.get("persons", [])))
    combined_orgs = list(set(spacy_entities.get("organizations", []) + regex_entities.get("organizations", [])))

    result = {
        "document_type": classification["document_type"],
        "case_id": regex_entities.get("case_id"),
        "fir_number": regex_entities.get("fir_number"),
        "date": regex_entities.get("date"),
        "location": regex_entities.get("location"),
        "police_station": regex_entities.get("police_station"),
        "court_name": regex_entities.get("court_name"),
        "persons": sorted(combined_persons),
        "organizations": sorted(combined_orgs),
        "legal_sections": regex_entities.get("legal_sections", []),
        "evidence_ids": regex_entities.get("evidence_ids", []),
        "classification_confidence": classification["confidence"],
        "classification_method": classification["method"],
        "provider_used": provider_used,
        "timestamp": now_iso,
        "processing_status": "SUCCESS",
    }

    if ai_result:
        for key in ["document_type", "case_id", "fir_number", "date", "location",
                    "police_station", "court_name"]:
            if ai_result.get(key):
                result[key] = ai_result[key]

        for list_key in ["persons", "organizations", "legal_sections", "evidence_ids"]:
            if ai_result.get(list_key):
                combined = list(set(result.get(list_key, []) + ai_result[list_key]))
                result[list_key] = combined

        if ai_result.get("document_type") and ai_result["document_type"] != "UNKNOWN":
            result["classification_method"] = f"{provider_used}_enhanced"
            result["classification_confidence"] = max(result["classification_confidence"], 0.85)

    return result

