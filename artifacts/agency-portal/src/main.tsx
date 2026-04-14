import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupabaseAuthProvider } from "@/auth/SupabaseAuthContext";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Service worker registration failure is non-blocking for the app.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <SupabaseAuthProvider>
    <App />
  </SupabaseAuthProvider>,
);
