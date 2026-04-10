import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupabaseAuthProvider } from "@/auth/SupabaseAuthContext";

createRoot(document.getElementById("root")!).render(
  <SupabaseAuthProvider>
    <App />
  </SupabaseAuthProvider>,
);
