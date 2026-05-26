import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupabaseAuthProvider } from "@/auth/SupabaseAuthContext";

// Tema: solo chiaro (giorno). Nessuna modalità scura — rimuoviamo la classe
// `dark` e azzeriamo l'eventuale preferenza salvata da build precedenti.
document.documentElement.classList.remove("dark");
try { localStorage.setItem("theme", "light"); } catch { /* storage non disponibile */ }

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
