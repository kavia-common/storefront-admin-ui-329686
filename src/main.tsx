import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { StoreSessionProvider } from "./shared/session/StoreSessionContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreSessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreSessionProvider>
  </React.StrictMode>,
);
