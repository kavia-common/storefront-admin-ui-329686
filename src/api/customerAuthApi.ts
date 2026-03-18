import type { ApiLogger, ApiResponse } from "./httpClient";
import { createHttpClient, parseJson } from "./httpClient";
import { getApiRequestContext } from "../shared/session/storeSession";
import type { CustomerAuthFlowResult, CustomerLoginInput, CustomerRegisterInput } from "../shared/auth/customerAuth";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function pickToken(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  // Best-effort extraction across common conventions.
  return (
    asString(payload.access_token) ??
    asString(payload.accessToken) ??
    asString(payload.token) ??
    asString(payload.id_token) ??
    (isRecord(payload.data) ? pickToken(payload.data) : undefined)
  );
}

function pickProfile(payload: unknown): { id?: string; email?: string; firstName?: string; lastName?: string } | undefined {
  if (!isRecord(payload)) return undefined;

  const candidate = (isRecord(payload.customer) ? payload.customer : payload) as JsonRecord;
  if (!isRecord(candidate)) return undefined;

  const id = asString(candidate.id) ?? asString(candidate.customerId) ?? asString(candidate.uuid);
  const email = asString(candidate.email) ?? asString(candidate.username);
  const firstName = asString(candidate.firstName) ?? asString(candidate.given_name);
  const lastName = asString(candidate.lastName) ?? asString(candidate.family_name);

  if (!id && !email && !firstName && !lastName) return undefined;
  return { id, email, firstName, lastName };
}

async function tryPostJson(
  http: ReturnType<typeof createHttpClient>,
  params: { operation: string; path: string; body: unknown },
): Promise<ApiResponse<unknown>> {
  return http.request<unknown>({
    operation: params.operation,
    method: "POST",
    path: params.path,
    headers: { Accept: "application/json" },
    body: params.body,
    parse: parseJson<unknown>(),
  });
}

// PUBLIC_INTERFACE
export function createCustomerAuthApi(params: { basePath: string; logger?: ApiLogger; defaultStoreId?: string }) {
  /**
   * Customer auth API adapter.
   *
   * Contract:
   * - Inputs: login/register payloads
   * - Outputs: CustomerAuthFlowResult (never throws)
   * - Errors: network/404/etc surfaced as ok:false + message + status
   * - Side effects: performs fetch calls
   */
  const http = createHttpClient({
    basePath: params.basePath,
    logger: params.logger,
    contextProvider: () => getApiRequestContext({ fallbackStoreId: params.defaultStoreId }),
  });

  const loginPaths = [
    // Most likely candidates (if gateway exposes a customer/auth service).
    "/auth/login",
    "/v1/auth/login",
    "/customers/login",
    "/v1/customers/login",
    "/auth/token",
  ];

  const registerPaths = [
    "/auth/register",
    "/v1/auth/register",
    "/customers/register",
    "/v1/customers/register",
    // Some systems register via POST /customers
    "/customers",
    "/v1/customers",
  ];

  async function loginBackend(input: CustomerLoginInput): Promise<CustomerAuthFlowResult> {
    const operationBase = "auth.customer.login";

    for (const path of loginPaths) {
      const operation = `${operationBase}${path.replaceAll("/", ".")}`;
      const r = await tryPostJson(http, { operation, path, body: { username: input.email, email: input.email, password: input.password } });

      if (r.ok) {
        const token = pickToken(r.data);
        const profile = pickProfile(r.data);
        return {
          ok: true,
          session: {
            status: "authenticated",
            source: "backend",
            accessToken: token,
            profile: profile
              ? {
                  id: profile.id,
                  email: profile.email ?? input.email,
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  displayName:
                    profile.firstName || profile.lastName
                      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
                      : profile.email ?? input.email,
                }
              : { email: input.email, displayName: input.email },
            updatedAt: new Date().toISOString(),
          },
          notice: token
            ? undefined
            : `Login succeeded via ${path}, but no token was found in the response. Secured APIs may still require VITE_DEV_BEARER_TOKEN.`,
        };
      }

      // If endpoint isn't present, keep trying.
      if (r.status === 404) continue;

      // For non-404 failures, return immediately (credentials/validation/etc).
      return { ok: false, status: r.status, error: r.error.message };
    }

    return {
      ok: false,
      status: 404,
      error: "No backend login endpoint was found.",
      notice: "Backend auth endpoints were not detected (all candidates returned 404).",
    };
  }

  async function registerBackend(input: CustomerRegisterInput): Promise<CustomerAuthFlowResult> {
    const operationBase = "auth.customer.register";

    for (const path of registerPaths) {
      const operation = `${operationBase}${path.replaceAll("/", ".")}`;
      const r = await tryPostJson(http, {
        operation,
        path,
        body: {
          email: input.email,
          username: input.email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      if (r.ok) {
        // Some APIs return token on register; attempt to extract.
        const token = pickToken(r.data);
        const profile = pickProfile(r.data);

        return {
          ok: true,
          session: {
            status: "authenticated",
            source: "backend",
            accessToken: token,
            profile: profile
              ? {
                  id: profile.id,
                  email: profile.email ?? input.email,
                  firstName: profile.firstName ?? input.firstName,
                  lastName: profile.lastName ?? input.lastName,
                  displayName:
                    profile.firstName || profile.lastName
                      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
                      : profile.email ?? input.email,
                }
              : {
                  email: input.email,
                  firstName: input.firstName,
                  lastName: input.lastName,
                  displayName: `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || input.email,
                },
            updatedAt: new Date().toISOString(),
          },
          notice: token
            ? undefined
            : `Registration succeeded via ${path}, but no token was found. You may need to login separately or set VITE_DEV_BEARER_TOKEN for secured APIs.`,
        };
      }

      if (r.status === 404) continue;

      return { ok: false, status: r.status, error: r.error.message };
    }

    return {
      ok: false,
      status: 404,
      error: "No backend registration endpoint was found.",
      notice: "Backend auth endpoints were not detected (all candidates returned 404).",
    };
  }

  return {
    loginBackend,
    registerBackend,
  };
}
