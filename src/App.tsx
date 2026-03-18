import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AdminLayout } from "./app/layouts/AdminLayout";
import { StorefrontLayout } from "./app/layouts/StorefrontLayout";
import { NotFoundPage } from "./app/pages/NotFoundPage";
import { AdminCatalogPage } from "./features/admin/pages/AdminCatalogPage";
import { AdminDashboardPage } from "./features/admin/pages/AdminDashboardPage";
import { AdminOrdersPage } from "./features/admin/pages/AdminOrdersPage";
import { CartPage } from "./features/storefront/pages/CartPage";
import { CategoriesPage } from "./features/storefront/pages/CategoriesPage";
import { CheckoutPage } from "./features/storefront/pages/CheckoutPage";
import { OrderConfirmationPage } from "./features/storefront/pages/OrderConfirmationPage";
import { MyAccountPage } from "./features/storefront/pages/MyAccountPage";
import { CustomerLoginPage } from "./features/storefront/pages/CustomerLoginPage";
import { CustomerRegisterPage } from "./features/storefront/pages/CustomerRegisterPage";
import { OrderHistoryPage } from "./features/storefront/pages/OrderHistoryPage";
import { OrderDetailPage } from "./features/storefront/pages/OrderDetailPage";
import { ProductsPage } from "./features/storefront/pages/ProductsPage";
import { ProductDetailPage } from "./features/storefront/pages/ProductDetailPage";
import { StorefrontHomePage } from "./features/storefront/pages/StorefrontHomePage";

// PUBLIC_INTERFACE
function App() {
  /**
   * Top-level app router.
   *
   * Route trees:
   * - "/"      => Storefront
   * - "/admin" => Admin console
   */
  return (
    <Routes>
      <Route path="/" element={<StorefrontLayout />}>
        <Route index element={<StorefrontHomePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:sku" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="checkout/confirmation" element={<OrderConfirmationPage />} />
        <Route path="account" element={<MyAccountPage />} />
        <Route path="account/login" element={<CustomerLoginPage />} />
        <Route path="account/register" element={<CustomerRegisterPage />} />
        <Route path="account/orders" element={<OrderHistoryPage />} />
        <Route path="account/orders/:orderId" element={<OrderDetailPage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="catalog" element={<AdminCatalogPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
      </Route>

      {/* Convenience redirects (optional, but helpful during navigation). */}
      <Route path="/storefront" element={<Navigate to="/" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
