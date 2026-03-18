import { Outlet } from "react-router-dom";
import { AppHeader } from "../../shared/components/AppHeader";

// PUBLIC_INTERFACE
export function StorefrontLayout() {
  /** Storefront route tree layout (shared header + page container). */
  return (
    <div className="appShell">
      <AppHeader />
      <main className="appMain" role="main">
        <div className="pageContainer">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
