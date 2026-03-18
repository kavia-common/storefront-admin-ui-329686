import { createShopizerApi } from "./shopizerApi";

/**
 * Default to the Vite proxy path.
 * You may override by setting:
 * - VITE_API_BASE_PATH=/api   (default)
 * - VITE_API_BASE_PATH=/some/other/prefix
 */
const basePath = (import.meta.env.VITE_API_BASE_PATH as string | undefined) ?? "/api";

/** PUBLIC_INTERFACE
 * Canonical base path for frontend API requests (usually "/api" for the Vite proxy).
 */
export const API_BASE_PATH = basePath;

/**
 * Optional Shopizer Modern store UUID used by catalog endpoints like:
 *   GET /api/v1/catalog/stores/{storeId}/categories
 *
 * If not provided, category loading will fail because the UI no longer attempts any legacy fallback endpoints.
 *
 * Configure via:
 * - VITE_DEFAULT_STORE_ID=<uuid>
 *
 * MVP default:
 * - In the Shopizer Modern MVP seed data, the DEFAULT store has a deterministic UUID:
 *   00000000-0000-0000-0000-000000000001
 *   (see: shopizer-modern-java21/docs/how-to-find-store-uuid.md)
 */
const defaultStoreIdRaw = import.meta.env.VITE_DEFAULT_STORE_ID as string | undefined;
const defaultStoreId =
  defaultStoreIdRaw && defaultStoreIdRaw.trim().length > 0
    ? defaultStoreIdRaw.trim()
    : "00000000-0000-0000-0000-000000000001";

/**
 * Default merchant store UUID used by the storefront when it needs a store context
 * (catalog + cart/checkout flows).
 */
// PUBLIC_INTERFACE
export const DEFAULT_STORE_ID = defaultStoreId;

// PUBLIC_INTERFACE
export const shopizerApi = createShopizerApi({ basePath, defaultStoreId });
