import { safeGetItem, safeSetItem } from "./localStorage";

const SHOW_DEVELOPER_DETAILS_KEY = "shopizer.ui.showDeveloperDetails.v1";
const SHOW_ADMIN_SESSION_OPTIONS_KEY = "shopizer.ui.showAdminSessionOptions.v1";

function parseBoolean(raw: string | null): boolean | null {
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

// PUBLIC_INTERFACE
export function getShowDeveloperDetails(): boolean {
  /**
   * Returns whether developer/debug details should be shown in the UI.
   *
   * Default: false (hide developer details) to provide a more user-friendly storefront.
   */
  const parsed = parseBoolean(safeGetItem(SHOW_DEVELOPER_DETAILS_KEY));
  return parsed ?? false;
}

// PUBLIC_INTERFACE
export function setShowDeveloperDetails(show: boolean) {
  /**
   * Persists the user's preference for showing developer/debug details.
   *
   * This is intentionally a UI-only local preference (per browser), and does not
   * change any service calls or backend behavior.
   */
  safeSetItem(SHOW_DEVELOPER_DETAILS_KEY, String(Boolean(show)));
}

// PUBLIC_INTERFACE
export function getShowDeveloperDetailsStorageKey(): string {
  /** Returns the storage key so session providers can listen for cross-tab updates. */
  return SHOW_DEVELOPER_DETAILS_KEY;
}

// PUBLIC_INTERFACE
export function getShowAdminSessionOptions(): boolean {
  /**
   * Returns whether admin + session navigation options should be shown in the top bar.
   *
   * Default: false (hide these options) so the header only shows storefront links.
   */
  const parsed = parseBoolean(safeGetItem(SHOW_ADMIN_SESSION_OPTIONS_KEY));
  return parsed ?? false;
}

// PUBLIC_INTERFACE
export function setShowAdminSessionOptions(show: boolean) {
  /**
   * Persists the user's preference for showing admin + session navigation options.
   *
   * UI-only local preference (per browser). Useful for demos and developer workflows.
   */
  safeSetItem(SHOW_ADMIN_SESSION_OPTIONS_KEY, String(Boolean(show)));
}

// PUBLIC_INTERFACE
export function getShowAdminSessionOptionsStorageKey(): string {
  /** Returns the storage key so session providers can listen for cross-tab updates. */
  return SHOW_ADMIN_SESSION_OPTIONS_KEY;
}
