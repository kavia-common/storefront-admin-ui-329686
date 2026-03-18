import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getOrCreateCurrency,
  getOrCreateCustomerId,
  getOrCreateLanguage,
  getOrCreateStoreId,
  resetCustomerId,
  setCurrency,
  setLanguage,
  setStoreId,
} from "./storeSession";
import {
  clearCustomerAuthSession,
  createCustomerAuthFlow,
  getCustomerAuthStorageKey,
  getDevBearerTokenFromEnv,
  loadPersistedCustomerAuthSession,
  normalizeBearerToken,
  saveCustomerAuthSession,
  type CustomerAuthSession,
  type CustomerLoginInput,
  type CustomerRegisterInput,
} from "../auth/customerAuth";
import { API_BASE_PATH } from "../../api";
import { createCustomerAuthApi } from "../../api/customerAuthApi";
import {
  getShowAdminSessionOptions,
  getShowAdminSessionOptionsStorageKey,
  getShowDeveloperDetails,
  getShowDeveloperDetailsStorageKey,
  setShowAdminSessionOptions,
  setShowDeveloperDetails,
} from "./uiPreferences";

export type StoreSessionState = {
  storeId: string;
  customerId: string;
  currency: string;
  language: string;
  auth: CustomerAuthSession;

  /** UI-only preference: show/hide developer-oriented copy (endpoints, IDs, env/debug details). */
  showDeveloperDetails: boolean;

  /**
   * UI-only preference: show/hide admin console links and session controls in the header.
   * Default: false (storefront-only header).
   */
  showAdminSessionOptions: boolean;
};

export type StoreSessionDerived = {
  /** Whether the UI considers the customer signed in (may be via dev token or local fallback). */
  isAuthenticated: boolean;
  /** Authorization header value ("Bearer ...") to use for secured APIs, when available. */
  bearerToken?: string;
  /** Friendly label for header/account views. */
  authLabel: string;

  /** Mirrors state.showDeveloperDetails for convenience. */
  showDeveloperDetails: boolean;

  /** Mirrors state.showAdminSessionOptions for convenience. */
  showAdminSessionOptions: boolean;
};

export type StoreSessionActions = {
  setStoreId: (storeId: string) => void;
  setCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  resetCustomerId: () => void;

  /** UI-only preference: show/hide developer/debug details across storefront pages. */
  setShowDeveloperDetails: (show: boolean) => void;

  /** UI-only preference: show/hide admin console links and session controls in the header. */
  setShowAdminSessionOptions: (show: boolean) => void;

  /** Attempts backend login when possible; falls back to local UI-only sign-in when unavailable. */
  loginCustomer: (input: CustomerLoginInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Attempts backend registration when possible; falls back to local UI-only sign-in when unavailable. */
  registerCustomer: (input: CustomerRegisterInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Clears auth session (returns to guest). */
  logoutCustomer: () => void;
};

type StoreSessionContextValue = {
  state: StoreSessionState;
  derived: StoreSessionDerived;
  actions: StoreSessionActions;
};

const StoreSessionContext = createContext<StoreSessionContextValue | null>(null);

function guestAuthSession(): CustomerAuthSession {
  return { status: "guest", source: "local", updatedAt: new Date().toISOString() };
}

function computeAuthLabel(auth: CustomerAuthSession): string {
  if (auth.status !== "authenticated") return "Guest";
  const name = auth.profile?.displayName?.trim() || auth.profile?.email?.trim();
  if (name) return name;
  return auth.source === "devToken" ? "Dev token" : "Signed in";
}

// PUBLIC_INTERFACE
export function StoreSessionProvider(props: { children: React.ReactNode }) {
  /** Provides persisted store/customer/currency/language context AND customer auth state (with graceful fallbacks). */
  const devToken = getDevBearerTokenFromEnv();

  const authApi = useMemo(() => {
    return createCustomerAuthApi({ basePath: API_BASE_PATH, defaultStoreId: getOrCreateStoreId() });
  }, []);

  const authFlow = useMemo(() => {
    return createCustomerAuthFlow({
      backend: {
        login: (input) => authApi.loginBackend(input),
        register: (input) => authApi.registerBackend(input),
      },
    });
  }, [authApi]);

  const [state, setState] = useState<StoreSessionState>(() => {
    const persisted = loadPersistedCustomerAuthSession();
    const initialAuth: CustomerAuthSession =
      persisted ??
      (devToken
        ? {
            status: "authenticated",
            source: "devToken",
            accessToken: devToken,
            profile: { displayName: "Dev token" },
            updatedAt: new Date().toISOString(),
          }
        : guestAuthSession());

    return {
      storeId: getOrCreateStoreId(),
      customerId: getOrCreateCustomerId(),
      currency: getOrCreateCurrency(),
      language: getOrCreateLanguage(),
      auth: initialAuth,
      showDeveloperDetails: getShowDeveloperDetails(),
      showAdminSessionOptions: getShowAdminSessionOptions(),
    };
  });

  // Keep state synced if localStorage is modified in another tab/window.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;

      const authKey = getCustomerAuthStorageKey();
      const showDevKey = getShowDeveloperDetailsStorageKey();
      const showAdminKey = getShowAdminSessionOptionsStorageKey();

      if (
        e.key === "shopizer.storeId.v1" ||
        e.key === "shopizer.customerId.v1" ||
        e.key === "shopizer.currency.v1" ||
        e.key === "shopizer.language.v1" ||
        e.key === authKey ||
        e.key === showDevKey ||
        e.key === showAdminKey
      ) {
        setState((prev) => ({
          ...prev,
          storeId: getOrCreateStoreId(),
          customerId: getOrCreateCustomerId(),
          currency: getOrCreateCurrency(),
          language: getOrCreateLanguage(),
          auth: loadPersistedCustomerAuthSession() ?? prev.auth,
          showDeveloperDetails: getShowDeveloperDetails(),
          showAdminSessionOptions: getShowAdminSessionOptions(),
        }));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const derived = useMemo<StoreSessionDerived>(() => {
    const explicit = normalizeBearerToken(state.auth.accessToken);
    const env = normalizeBearerToken(devToken);
    const bearerToken = explicit ?? env;

    const isAuthenticated =
      state.auth.status === "authenticated" ||
      Boolean(env); // dev token implies authenticated access for secured APIs even without explicit login UI

    const authLabel = computeAuthLabel(
      state.auth.status === "guest" && env
        ? {
            status: "authenticated",
            source: "devToken",
            accessToken: devToken,
            profile: { displayName: "Dev token" },
            updatedAt: state.auth.updatedAt,
          }
        : state.auth,
    );

    return {
      bearerToken,
      isAuthenticated,
      authLabel,
      showDeveloperDetails: state.showDeveloperDetails,
      showAdminSessionOptions: state.showAdminSessionOptions,
    };
  }, [devToken, state.auth, state.showDeveloperDetails, state.showAdminSessionOptions]);

  const actions = useMemo<StoreSessionActions>(() => {
    return {
      setStoreId: (id: string) => {
        setStoreId(id);
        setState((prev) => ({ ...prev, storeId: getOrCreateStoreId() }));
      },
      setCurrency: (c: string) => {
        setCurrency(c);
        setState((prev) => ({ ...prev, currency: getOrCreateCurrency() }));
      },
      setLanguage: (l: string) => {
        setLanguage(l);
        setState((prev) => ({ ...prev, language: getOrCreateLanguage() }));
      },
      resetCustomerId: () => {
        resetCustomerId();
        setState((prev) => ({ ...prev, customerId: getOrCreateCustomerId() }));
      },

      setShowDeveloperDetails: (show: boolean) => {
        setShowDeveloperDetails(show);
        setState((prev) => ({ ...prev, showDeveloperDetails: Boolean(show) }));
      },

      setShowAdminSessionOptions: (show: boolean) => {
        setShowAdminSessionOptions(show);
        setState((prev) => ({ ...prev, showAdminSessionOptions: Boolean(show) }));
      },

      loginCustomer: async (input) => {
        const r = await authFlow.login(input);
        if (!r.ok) return { ok: false as const, error: r.error };

        // Persist only non-devToken sessions so env remains source-of-truth for dev token usage.
        if (r.session.source === "devToken") {
          setState((prev) => ({ ...prev, auth: r.session }));
          return { ok: true as const };
        }

        saveCustomerAuthSession(r.session);
        setState((prev) => ({ ...prev, auth: r.session }));
        return { ok: true as const };
      },

      registerCustomer: async (input) => {
        const r = await authFlow.register(input);
        if (!r.ok) return { ok: false as const, error: r.error };

        saveCustomerAuthSession(r.session);
        setState((prev) => ({ ...prev, auth: r.session }));
        return { ok: true as const };
      },

      logoutCustomer: () => {
        clearCustomerAuthSession();
        setState((prev) => ({ ...prev, auth: guestAuthSession() }));
      },
    };
  }, [authFlow]);

  const value = useMemo<StoreSessionContextValue>(() => ({ state, derived, actions }), [state, derived, actions]);

  return <StoreSessionContext.Provider value={value}>{props.children}</StoreSessionContext.Provider>;
}

// PUBLIC_INTERFACE
export function useStoreSession(): StoreSessionContextValue {
  /** Hook to access the persisted store/dev-identity session state + customer auth state. */
  const ctx = useContext(StoreSessionContext);
  if (!ctx) {
    throw new Error("useStoreSession must be used within <StoreSessionProvider />");
  }
  return ctx;
}
