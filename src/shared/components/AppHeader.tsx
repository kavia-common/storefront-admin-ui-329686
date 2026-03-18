import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useStoreSession } from "../session/StoreSessionContext";

function linkClassName({ isActive }: { isActive: boolean }) {
  return `navLink ${isActive ? "navLinkActive" : ""}`;
}

function shortId(id: string): string {
  if (!id) return "";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// PUBLIC_INTERFACE
export function AppHeader() {
  /** Shared application header with storefront navigation and (optionally) admin + session widgets. */
  const {
    state: { storeId, customerId, currency, language, auth, showAdminSessionOptions },
    derived,
    actions,
  } = useStoreSession();

  const [storeDraft, setStoreDraft] = useState(storeId);
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [languageDraft, setLanguageDraft] = useState(language);

  useEffect(() => setStoreDraft(storeId), [storeId]);
  useEffect(() => setCurrencyDraft(currency), [currency]);
  useEffect(() => setLanguageDraft(language), [language]);

  const identityLabel = useMemo(() => shortId(customerId), [customerId]);

  return (
    <header className="appHeader" role="banner">
      <div className="appHeaderInner">
        <div className="brand" aria-label="Shopizer home">
          <span className="brandMark" aria-hidden="true">
            {/* Simple inline “S” mark to avoid external assets */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7.8 8.2c0-2 1.8-3.7 4.2-3.7 1.8 0 3.1.7 3.9 2.1.2.4.1.9-.3 1.1l-.6.3c-.4.2-.9 0-1.1-.4-.4-.7-1.1-1.1-2-1.1-1.3 0-2.2.7-2.2 1.6 0 1.1 1.3 1.4 2.9 1.8 2 .5 4.4 1.1 4.4 3.8 0 2.2-1.9 3.9-4.7 3.9-2.1 0-3.8-.9-4.6-2.4-.2-.4-.1-.9.3-1.1l.6-.3c.4-.2.9 0 1.1.4.5.9 1.5 1.4 2.6 1.4 1.6 0 2.7-.7 2.7-1.8 0-1.3-1.5-1.7-3.2-2.1-2-.5-4.1-1.1-4.1-3.5Z"
                fill="currentColor"
              />
            </svg>
          </span>

          <span className="brandText">
            <span className="brandName">Shopizer</span>
            <span className="brandTagline">Modern commerce UI</span>
          </span>
        </div>

        <nav className="navGroups" aria-label="Primary">
          <div className="navGroup" aria-label="Storefront">
            <span className="navGroupTitle">Storefront</span>
            <NavLink to="/" end className={linkClassName}>
              Home
            </NavLink>
            <NavLink to="/categories" className={linkClassName}>
              Categories
            </NavLink>
            <NavLink to="/products" className={linkClassName}>
              Products
            </NavLink>
            <NavLink to="/cart" className={linkClassName}>
              Cart
            </NavLink>
            <NavLink to="/checkout" className={linkClassName}>
              Checkout
            </NavLink>
            <NavLink to="/account/orders" className={linkClassName}>
              Orders
            </NavLink>
            <NavLink to="/account" className={linkClassName}>
              My Account
            </NavLink>
          </div>

          {showAdminSessionOptions ? (
            <>
              <div className="navGroup" aria-label="Admin console">
                <span className="navGroupTitle">Admin</span>
                <NavLink to="/admin" end className={linkClassName}>
                  Dashboard
                </NavLink>
                <NavLink to="/admin/catalog" className={linkClassName}>
                  Catalog
                </NavLink>
                <NavLink to="/admin/orders" className={linkClassName}>
                  Orders
                </NavLink>
              </div>

              <div className="navGroup" aria-label="Session">
                <span className="navGroupTitle">Session</span>

                <details className="sessionDetails">
                  <summary className="sessionSummary">
                    Session settings{" "}
                    <span className="sessionSummaryHint">
                      · {auth.status === "authenticated" ? "signed in" : "guest"} ·{" "}
                      {auth.status === "authenticated" ? derived.authLabel : identityLabel}
                    </span>
                  </summary>

                  <div className="sessionWidget" style={{ marginTop: "0.75rem" }}>
                    <label className="sessionField">
                      <span className="sessionLabel">Store UUID</span>
                      <input
                        className="sessionInput"
                        value={storeDraft}
                        onChange={(e) => setStoreDraft(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000001"
                        aria-label="Store UUID"
                      />
                    </label>

                    <button
                      className="btn btnSm"
                      onClick={() => actions.setStoreId(storeDraft)}
                      disabled={!storeDraft.trim() || storeDraft.trim() === storeId}
                      aria-label="Save store UUID"
                    >
                      Set
                    </button>

                    <label className="sessionField">
                      <span className="sessionLabel">Currency</span>
                      <input
                        className="sessionInput"
                        style={{ width: 88 }}
                        value={currencyDraft}
                        onChange={(e) => setCurrencyDraft(e.target.value)}
                        placeholder="USD"
                        aria-label="Currency"
                      />
                    </label>

                    <button
                      className="btn btnSm"
                      onClick={() => actions.setCurrency(currencyDraft)}
                      disabled={!currencyDraft.trim() || currencyDraft.trim().toUpperCase() === currency}
                      aria-label="Save currency"
                    >
                      Set
                    </button>

                    <label className="sessionField">
                      <span className="sessionLabel">Lang</span>
                      <input
                        className="sessionInput"
                        style={{ width: 76 }}
                        value={languageDraft}
                        onChange={(e) => setLanguageDraft(e.target.value)}
                        placeholder="en"
                        aria-label="Language"
                      />
                    </label>

                    <button
                      className="btn btnSm"
                      onClick={() => actions.setLanguage(languageDraft)}
                      disabled={!languageDraft.trim() || languageDraft.trim() === language}
                      aria-label="Save language"
                    >
                      Set
                    </button>

                    <span className="muted" style={{ whiteSpace: "nowrap" }} title={auth.profile?.email ?? customerId}>
                      {auth.status === "authenticated" ? (
                        <>
                          Signed in: <code>{derived.authLabel}</code>
                          {derived.bearerToken ? <span className="muted"> · token</span> : <span className="muted"> · no token</span>}
                        </>
                      ) : (
                        <>
                          Guest: <code>{identityLabel}</code>
                        </>
                      )}
                    </span>

                    {auth.status === "authenticated" ? (
                      <button className="btn btnSm btnDanger" onClick={() => actions.logoutCustomer()} aria-label="Sign out">
                        Sign out
                      </button>
                    ) : (
                      <>
                        <NavLink to="/account/login" className={linkClassName}>
                          Sign in
                        </NavLink>
                        <NavLink to="/account/register" className={linkClassName}>
                          Register
                        </NavLink>

                        <button
                          className="btn btnSm btnGhost"
                          onClick={() => actions.resetCustomerId()}
                          aria-label="Regenerate guest identity"
                        >
                          New guest
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
