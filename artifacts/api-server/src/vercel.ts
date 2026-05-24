import app from "./app";

// Entry per Vercel Functions (Fluid Compute): esportiamo l'app Express come
// handler della function, senza app.listen() (quello resta in index.ts per
// l'esecuzione long-running locale/Render).
//
// Guardia produzione: a differenza di index.ts non possiamo usare process.exit
// (il modulo viene caricato dentro la function), quindi blocchiamo al load con
// un throw se l'auth è disabilitata in produzione.
if (
  process.env.NODE_ENV === "production" &&
  process.env.API_AUTH_DISABLED === "true"
) {
  throw new Error(
    "[SECURITY] API_AUTH_DISABLED=true non è consentito in produzione.",
  );
}

export default app;
