import { getUserId } from "./user";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
  isDefault: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  categoryId?: string | null;
  date: number;
  note: string;
  paymentMethod: string;
  source: string;
  smsReference?: string | null;
  isWalletSpend: boolean;
  linkedWalletLoadId?: string | null;
  reviewed: boolean;
  merchant?: string | null;
}

export interface WalletLoad {
  id: string;
  amount: number;
  walletType: string;
  date: number;
  smsReference?: string | null;
  status: string;
  allocated: number;
  remaining: number;
  linkedExpenses: Expense[];
}

export interface BreakdownItem {
  categoryId: string;
  name: string;
  icon: string;
  amount: number;
  percent: number;
}

export interface DashboardData {
  month: number;
  year: number;
  total: number;
  dailyAverage: number;
  topCategories: BreakdownItem[];
  breakdown: BreakdownItem[];
  smsTotal: number;
  manualTotal: number;
  recent: Expense[];
  count: number;
}

export interface ReportData {
  total: number;
  count: number;
  breakdown: BreakdownItem[];
  transactions: Expense[];
  smsTotal: number;
  manualTotal: number;
}

// The bundled React Native `fetch`/`XMLHttpRequest` polyfills can fail to
// deliver POST responses behind the preview proxy on web. The browser's
// *native* window.fetch works correctly, so we use it on web. On native
// (Android/iOS) `window` is undefined and React Native's networking is used.
const nativeFetch: typeof fetch =
  typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : fetch;

function genClientId(): string {
  return "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function attempt(method: string, url: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method };
  if (body != null) {
    // NOTE: intentionally omit the "Content-Type" header. Expo's dev-mode
    // network inspector can stall POST/PATCH requests that carry a JSON
    // content-type behind the preview proxy. Starlette parses the JSON body
    // regardless of the header, so this is safe.
    init.body = JSON.stringify(body);
  }
  const fetchPromise = nativeFetch(url, init);
  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("__timeout__")), 8000)
  );
  return Promise.race([fetchPromise, timeoutPromise]);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  // Retry on timeout/network errors. Mutations carry a clientId so the server
  // de-duplicates retried requests whose first response was lost in transit.
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await attempt(method, url, body);
      const text = await res.text();
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const j = JSON.parse(text);
          if (j.detail) detail = j.detail;
        } catch {}
        throw new Error(detail);
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (e: any) {
      lastErr = e;
      const retriable = e?.message === "__timeout__" || e?.name === "TypeError";
      if (!retriable) throw e;
    }
  }
  throw new Error(
    lastErr?.message === "__timeout__"
      ? "Request timed out. Please try again."
      : lastErr?.message || "Network error"
  );
}

export const api = {
  async getCategories(): Promise<Category[]> {
    const uid = await getUserId();
    return request("GET", `/categories?user_id=${uid}`);
  },

  async parse(text: string): Promise<{ amount: number | null; description: string; categoryId: string | null }> {
    const uid = await getUserId();
    return request("POST", `/parse`, { user_id: uid, text });
  },

  async parseSms(text: string): Promise<any> {
    const uid = await getUserId();
    return request("POST", `/parse-sms`, { user_id: uid, text });
  },

  async ingestSms(text: string): Promise<any> {
    const uid = await getUserId();
    return request("POST", `/sms/ingest`, { user_id: uid, text });
  },

  async createExpense(payload: Partial<Expense>): Promise<Expense> {
    const uid = await getUserId();
    return request("POST", `/expenses`, { user_id: uid, clientId: genClientId(), ...payload });
  },

  async updateExpense(id: string, payload: Partial<Expense>): Promise<Expense> {
    const uid = await getUserId();
    return request("PATCH", `/expenses/${id}?user_id=${uid}`, payload);
  },

  async deleteExpense(id: string): Promise<void> {
    const uid = await getUserId();
    await request("DELETE", `/expenses/${id}?user_id=${uid}`);
  },

  async pendingReview(): Promise<Expense[]> {
    const uid = await getUserId();
    return request("GET", `/pending-review?user_id=${uid}`);
  },

  async getWalletLoads(): Promise<WalletLoad[]> {
    const uid = await getUserId();
    return request("GET", `/wallet-loads?user_id=${uid}`);
  },

  async createWalletLoad(amount: number, walletType: string): Promise<WalletLoad> {
    const uid = await getUserId();
    return request("POST", `/wallet-loads`, { user_id: uid, amount, walletType, clientId: genClientId() });
  },

  async dashboard(year?: number, month?: number): Promise<DashboardData> {
    const uid = await getUserId();
    let q = `/dashboard?user_id=${uid}`;
    if (year) q += `&year=${year}`;
    if (month) q += `&month=${month}`;
    return request("GET", q);
  },

  async reports(params: { period: string; year?: number; month?: number; start?: number; end?: number }): Promise<ReportData> {
    const uid = await getUserId();
    let q = `/reports?user_id=${uid}&period=${params.period}`;
    if (params.year) q += `&year=${params.year}`;
    if (params.month) q += `&month=${params.month}`;
    if (params.start) q += `&start=${params.start}`;
    if (params.end) q += `&end=${params.end}`;
    return request("GET", q);
  },
};
