// Vercel Function (entry unico per tutta l'API).
//
// Importiamo il bundle ESM pre-buildato dall'esbuild dell'api-server (lo stesso
// che gira su Render), evitando che @vercel/node ricompili/risolva i sorgenti
// TS in "no-bundle" mode — dove il mix ESM/CJS + import senza estensione rompe
// a runtime. L'estensione .mjs rende l'entry ESM in modo non ambiguo.
//
// vercel.json fa rewrite /api/(.*) -> /api preservando req.url, così l'app
// Express (montata su "/api") instrada nativamente tutti i path.
import app from "../artifacts/api-server/dist/vercel.mjs";

export default app;
