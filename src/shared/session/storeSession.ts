import { safeGetItem, safeRemoveItem, safeSetItem } from "./localStorage";

const CUSTOMER_ID_KEY = "shopizer.customerId.v1";
const STORE_ID_KEY = "shopizer.storeId.v1";
const CURRENCY_KEY = "shopizer.currency.v1";
const LANGUAGE_KEY = "shopizer.language.v1";

function envString(key: string): string | undefined {
  // Vite replaces import.meta.env at build time; still guard for safety.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (import.meta as any)?.env?.[key] as string | undefined;
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

function defaultStoreIdFromEnv(): string {
  const raw = envString("VITE_DEFAULT_STORE_ID");
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;

  // Match the existing MVP deterministic seed store id used elsewhere in the UI.
  return "00000000-0000-0000-0000-000000000001";
}

function generateUuidV4(): string {
  // Prefer the browser built-in generator.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback (not cryptographically strong, but sufficient for UI-only identity).
  const s = `${Date.now()}-${Math.random()}-${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;

  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, "0").slice(0, len);
  return `${hex(hash, 8)}-${hex(hash ^ 0x12345678, 4)}-4${hex(hash ^ 0x87654321, 3)}-a${hex(
    hash ^ 0x13572468,
    3,
  )}-${hex(hash ^ 0xdeadbeef, 12)}`;
}

// PUBLIC_INTERFACE
export function getOrCreateCustomerId(): string {
  /** Returns a stable per-browser customer UUID (dev/guest identity) until real auth is implemented. */
  const existing = safeGetItem(CUSTOMER_ID_KEY);
  if (existing && existing.trim()) return existing.trim();

  const id = generateUuidV4();
  safeSetItem(CUSTOMER_ID_KEY, id);
  return id;
}

// PUBLIC_INTERFACE
export function resetCustomerId(): string {
  /** Regenerates the dev/guest identity id (customerId) and returns the new value. */
  safeRemoveItem(CUSTOMER_ID_KEY);
  return getOrCreateCustomerId();
}

// PUBLIC_INTERFACE
export function getOrCreateStoreId(fallbackStoreId?: string): string {
  /** Returns a persisted selected store UUID; defaults to VITE_DEFAULT_STORE_ID (or deterministic MVP fallback). */
  const existing = safeGetItem(STORE_ID_KEY);
  if (existing && existing.trim()) return existing.trim();

  const id = (fallbackStoreId?.trim() ? fallbackStoreId.trim() : defaultStoreIdFromEnv()).trim();
  safeSetItem(STORE_ID_KEY, id);
  return id;
}

// PUBLIC_INTERFACE
export function setStoreId(storeId: string) {
  /** Persists the selected store UUID. */
  safeSetItem(STORE_ID_KEY, storeId.trim());
}

// PUBLIC_INTERFACE
export function getOrCreateCurrency(): string {
  /** Returns a stable currency code for cart flows. Defaults to USD. */
  const existing = safeGetItem(CURRENCY_KEY);
  if (existing && existing.trim()) return existing.trim().toUpperCase();
  safeSetItem(CURRENCY_KEY, "USD");
  return "USD";
}

// PUBLIC_INTERFACE
export function setCurrency(currency: string) {
  /** Persists currency code (normalized to upper-case). */
  const c = currency.trim().toUpperCase();
  if (!c) return;
  safeSetItem(CURRENCY_KEY, c);
}

// PUBLIC_INTERFACE
export function getOrCreateLanguage(): string {
  /** Returns a persisted language code (BCP-47-ish). Defaults to "en". */
  const existing = safeGetItem(LANGUAGE_KEY);
  if (existing && existing.trim()) return existing.trim();
  safeSetItem(LANGUAGE_KEY, "en");
  return "en";
}

// PUBLIC_INTERFACE
export function setLanguage(language: string) {
  /** Persists language code. */
  const v = language.trim();
  if (!v) return;
  safeSetItem(LANGUAGE_KEY, v);
}

export type ApiRequestContext = {
  headers: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
};

// PUBLIC_INTERFACE
export function getApiRequestContext(input?: { fallbackStoreId?: string }): ApiRequestContext {
  /**
   * Builds default request context for API calls.
   *
   * Notes:
   * - These headers are frontend-only "context hints". Backends may ignore them.
   * - Explicit per-request headers/query always override these defaults.
   */
  const storeId = getOrCreateStoreId(input?.fallbackStoreId);
  const customerId = getOrCreateCustomerId();
  const currency = getOrCreateCurrency();
  const language = getOrCreateLanguage();

  return {
    headers: {
      "X-Shopizer-Store-Id": storeId,
      "X-Shopizer-Customer-Id": customerId,
      "X-Shopizer-Currency": currency,
      "X-Shopizer-Language": language,
    },
    // Keep query empty by default to avoid interfering with strict backends.
    query: undefined,
  };
}
