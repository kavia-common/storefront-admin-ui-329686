import { createShopizerApi } from "./shopizerApi";

/**
 * Default to the Vite proxy path.
 * You may override by setting:
 * - VITE_API_BASE_PATH=/api   (default)
 * - VITE_API_BASE_PATH=/some/other/prefix
 */
const basePath = (import.meta.env.VITE_API_BASE_PATH as string | undefined) ?? "/api";

/**
 * Optional Shopizer Modern store UUID used by catalog endpoints like:
 *   GET /api/v1/catalog/stores/{storeId}/categories
 *
 * If not provided, the UI will still attempt legacy endpoints as fallback.
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

// PUBLIC_INTERFACE
export const shopizerApi = createShopizerApi({ basePath, defaultStoreId });
