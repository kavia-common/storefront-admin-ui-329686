import { safeGetItem, safeRemoveItem, safeSetItem } from "../../../shared/session/localStorage";
import { getOrCreateCurrency, getOrCreateCustomerId } from "../../../shared/session/storeSession";

const BACKEND_CART_ID_KEY = "shopizer.backendCartId.v1";

// PUBLIC_INTERFACE
export { getOrCreateCustomerId, getOrCreateCurrency };

function safeGet(key: string): string | null {
  return safeGetItem(key);
}

function safeSet(key: string, value: string) {
  safeSetItem(key, value);
}

function safeRemove(key: string) {
  safeRemoveItem(key);
}

// PUBLIC_INTERFACE
export function getBackendCartId(): string | null {
  /** Returns last-known backend cart id (UUID) if stored. */
  const v = safeGet(BACKEND_CART_ID_KEY);
  return v && v.trim() ? v.trim() : null;
}

// PUBLIC_INTERFACE
export function setBackendCartId(cartId: string) {
  /** Persist backend cart id (UUID). */
  safeSet(BACKEND_CART_ID_KEY, cartId);
}

// PUBLIC_INTERFACE
export function clearBackendCartId() {
  /** Clear stored backend cart id. */
  safeRemove(BACKEND_CART_ID_KEY);
}
