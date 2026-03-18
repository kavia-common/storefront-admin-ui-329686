import { safeGetItem, safeRemoveItem, safeSetItem, safeWriteJson } from "../session/localStorage";

export type CustomerAuthSource = "backend" | "devToken" | "local";

export type CustomerProfile = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
};

export type CustomerAuthSession = {
  status: "guest" | "authenticated";
  source: CustomerAuthSource;
  /**
   * Access token used for authenticated backend calls (when present).
   * Should be stored WITHOUT "Bearer " prefix; normalization happens at request time.
   */
  accessToken?: string;
  profile?: CustomerProfile;
  updatedAt: string; // ISO
};

export type CustomerLoginInput = {
  email: string;
  password: string;
};

export type CustomerRegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
};

export type CustomerAuthFlowResult =
  | { ok: true; session: CustomerAuthSession; notice?: string }
  | { ok: false; error: string; status?: number; notice?: string };

const CUSTOMER_AUTH_KEY = "shopizer.customerAuth.v1";

function nowIso(): string {
  return new Date().toISOString();
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function normalizeBearerToken(token: string | undefined | null): string | undefined {
  /** Normalizes an access token into an Authorization header value ("Bearer ..."). */
  const t = token?.trim();
  if (!t) return undefined;
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
}

// PUBLIC_INTERFACE
export function getCustomerAuthStorageKey(): string {
  /** Returns the localStorage key used to persist customer auth state. */
  return CUSTOMER_AUTH_KEY;
}

// PUBLIC_INTERFACE
export function loadPersistedCustomerAuthSession(): CustomerAuthSession | null {
  /** Loads persisted customer auth session from localStorage (if any). */
  const raw = safeGetItem(CUSTOMER_AUTH_KEY);
  if (!raw) return null;

  const parsed = safeParseJson<CustomerAuthSession>(raw);
  if (!parsed || !isRecord(parsed)) return null;

  if (parsed.status !== "guest" && parsed.status !== "authenticated") return null;
  if (parsed.source !== "backend" && parsed.source !== "devToken" && parsed.source !== "local") return null;

  return {
    status: parsed.status,
    source: parsed.source,
    accessToken: asString(parsed.accessToken),
    profile: isRecord(parsed.profile) ? (parsed.profile as CustomerProfile) : undefined,
    updatedAt: asString(parsed.updatedAt) ?? nowIso(),
  };
}

// PUBLIC_INTERFACE
export function saveCustomerAuthSession(session: CustomerAuthSession) {
  /** Persists customer auth session to localStorage. */
  safeWriteJson(CUSTOMER_AUTH_KEY, {
    ...session,
    updatedAt: session.updatedAt || nowIso(),
  });
}

// PUBLIC_INTERFACE
export function clearCustomerAuthSession() {
  /** Clears persisted customer auth session. */
  safeRemoveItem(CUSTOMER_AUTH_KEY);
}

// PUBLIC_INTERFACE
export function getDevBearerTokenFromEnv(): string | undefined {
  /**
   * Reads optional dev JWT used for secured endpoints (order-service, etc.).
   * This is a convenience for MVP environments where real login endpoints may not be available.
   */
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = ((import.meta as any)?.env?.VITE_DEV_BEARER_TOKEN as string | undefined) ?? undefined;
    const t = raw?.trim();
    return t ? t : undefined;
  } catch {
    return undefined;
  }
}

function buildLocalAuthenticatedSession(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  notice?: string;
}): CustomerAuthFlowResult {
  const displayName =
    input.firstName?.trim() || input.lastName?.trim()
      ? `${input.firstName?.trim() ?? ""} ${input.lastName?.trim() ?? ""}`.trim()
      : input.email.trim();

  return {
    ok: true,
    notice:
      input.notice ??
      "Backend auth endpoints were not available. You are signed in locally (UI-only). Secured backend APIs may still require VITE_DEV_BEARER_TOKEN.",
    session: {
      status: "authenticated",
      source: "local",
      accessToken: undefined,
      profile: { email: input.email.trim(), firstName: input.firstName, lastName: input.lastName, displayName },
      updatedAt: nowIso(),
    },
  };
}

export type CustomerAuthBackendAdapter = {
  login: (input: CustomerLoginInput) => Promise<CustomerAuthFlowResult>;
  register: (input: CustomerRegisterInput) => Promise<CustomerAuthFlowResult>;
};

// PUBLIC_INTERFACE
export function createCustomerAuthFlow(params: {
  /**
   * Backend adapter may attempt real API endpoints (if any exist).
   * If not provided, the flow will always fall back to local UI-only auth.
   */
  backend?: CustomerAuthBackendAdapter;
}) {
  /**
   * Canonical customer-auth flow used by UI session state.
   *
   * Contract:
   * - Inputs: login/register payloads from UI
   * - Outputs: CustomerAuthFlowResult (never throws)
   * - Errors: returned as { ok:false, error, status? }
   * - Side effects: none (persistence is handled by caller)
   * - Observability: logs to console for traceability
   */
  const log = (level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console[level](`[CustomerAuthFlow] ${message}`, meta ?? {});
  };

  async function login(input: CustomerLoginInput): Promise<CustomerAuthFlowResult> {
    log("info", "login:start", { email: input.email });

    const email = input.email.trim();
    const password = input.password;

    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }

    if (params.backend) {
      const r = await params.backend.login({ email, password });
      if (r.ok) {
        log("info", "login:success", { source: r.session.source });
        return r;
      }

      // Missing endpoint / network: fall back to local sign-in.
      if (r.status === 0 || r.status === 404) {
        log("warn", "login:fallback_local", { status: r.status, error: r.error });
        return buildLocalAuthenticatedSession({ email, notice: r.notice });
      }

      log("warn", "login:failure", { status: r.status, error: r.error });
      return r;
    }

    log("warn", "login:no_backend_adapter_using_local");
    return buildLocalAuthenticatedSession({ email });
  }

  async function register(input: CustomerRegisterInput): Promise<CustomerAuthFlowResult> {
    log("info", "register:start", { email: input.email });

    const email = input.email.trim();
    const password = input.password;
    const confirmPassword = input.confirmPassword;

    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    if (params.backend) {
      const r = await params.backend.register({ ...input, email });
      if (r.ok) {
        log("info", "register:success", { source: r.session.source });
        return r;
      }

      if (r.status === 0 || r.status === 404) {
        log("warn", "register:fallback_local", { status: r.status, error: r.error });
        return buildLocalAuthenticatedSession({
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          notice: r.notice,
        });
      }

      log("warn", "register:failure", { status: r.status, error: r.error });
      return r;
    }

    log("warn", "register:no_backend_adapter_using_local");
    return buildLocalAuthenticatedSession({ email, firstName: input.firstName, lastName: input.lastName });
  }

  async function logout(): Promise<CustomerAuthFlowResult> {
    log("info", "logout:start");
    return {
      ok: true,
      session: {
        status: "guest",
        source: "local",
        accessToken: undefined,
        profile: undefined,
        updatedAt: nowIso(),
      },
    };
  }

  return {
    login,
    register,
    logout,
  };
}
