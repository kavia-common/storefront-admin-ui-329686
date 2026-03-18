import { NavLink } from "react-router-dom";

function linkClassName({ isActive }: { isActive: boolean }) {
  return `navLink ${isActive ? "navLinkActive" : ""}`;
}

// PUBLIC_INTERFACE
export function AppHeader() {
  /** Shared application header with storefront + admin navigation. */
  return (
    <header className="appHeader" role="banner">
      <div className="appHeaderInner">
        <div className="brand">Shopizer</div>

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
            <NavLink to="/account" className={linkClassName}>
              My Account
            </NavLink>
          </div>

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
        </nav>
      </div>
    </header>
  );
}
