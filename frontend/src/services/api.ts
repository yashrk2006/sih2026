import axios from 'axios';

let rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string) || '/api';
if (import.meta.env.VITE_API_BASE_URL && !rawBaseUrl.endsWith('/api') && !rawBaseUrl.endsWith('/api/')) {
  rawBaseUrl = rawBaseUrl.replace(/\/$/, '') + '/api';
}

const API_BASE = rawBaseUrl;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Storage keys
const ACCESS_TOKEN_KEY = 'sih_access_token';
const REFRESH_TOKEN_KEY = 'sih_refresh_token';

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setAuthTokens = (access: string | null, refresh?: string | null) => {
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } else if (refresh === null) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearAuthTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Universal Data Normalizer
 * Safe Array extraction for DRF paginated responses ({ count, results: [] }) or raw arrays ([]).
 */
export function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    if (Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
  }
  return [];
}

// Request Interceptor: Dynamically attach Bearer token to every request
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Token Expiration & Refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/token/')) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearAuthTokens();
        window.dispatchEvent(new Event('sih_auth_logout'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE}/auth/token/refresh/`, { refresh: refreshToken });
        const newAccessToken = res.data.access;
        setAuthTokens(newAccessToken);

        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);

        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthTokens();
        window.dispatchEvent(new Event('sih_auth_logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Type Definitions
export interface UserRole {
  username: string;
  role: 'ADMIN' | 'INVESTIGATOR' | 'LEGAL_OFFICER' | 'VIEWER' | 'AUDITOR';
  email: string;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  filename: string;
  original_filename: string;
  document_type: string;
  case_id?: string;
  status: string;
  sha256_hash: string;
  storage_location: string;
  is_encrypted: boolean;
  created_at: string;
  uploaded_by?: string;
}

export interface CaseItem {
  id: string;
  case_id: string;
  title: string;
  fir_number?: string;
  police_station?: string;
  court_name?: string;
  status: string;
  created_at: string;
  document_count?: number;
}

export interface IngestionResult {
  upload_status: string;
  filename: string;
  document_id: string;
  document_type: string;
  extracted_text: string;
  extracted_entities: {
    case_id?: string;
    fir_number?: string;
    persons: string[];
    organizations: string[];
    legal_sections: string[];
    evidence_ids: string[];
    date?: string;
    location?: string;
    police_station?: string;
  };
  case_association: {
    associated: boolean;
    case_id: string;
    case_title: string;
    method: string;
    confidence: number;
    reason: string;
  };
  sha256_hash: string;
  encryption_status: string;
  storage_location: string;
  signature_status: string;
  signature_hex: string;
  blockchain_status: string;
  blockchain_tx: string;
  audit_status: string;
}

export interface IntegrityVerificationResult {
  verified: boolean;
  status: string;
  expected_hash: string;
  actual_hash: string | null;
  signature_status?: string;
  blockchain_status?: string;
  blockchain_tx?: string;
  blockchain_anchored?: boolean;
  audit_status?: string;
}

export interface TamperTestResult {
  document_id?: string;
  filename?: string;
  verified: boolean;
  status: string;
  original_sha256?: string;
  tampered_sha256?: string | null;
  tampered_byte_position?: number;
  flip_mask?: string;
  note?: string;
  error?: string;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  action: string;
  actor: string;
  result: string;
  current_event_hash: string;
  previous_event_hash: string;
}

export interface AIProvider {
  id: string;
  name: string;
  available: boolean;
  installed?: boolean;
  status_code?: string;
  status_message?: string;
}

export interface AIProvidersResponse {
  providers: AIProvider[];
  selected: string;
}
